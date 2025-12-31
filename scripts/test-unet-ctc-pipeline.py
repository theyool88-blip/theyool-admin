"""
U-Net + CTC 모델 통합 테스트
"""

import os
import sys
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras

keras.config.enable_unsafe_deserialization()

# 모델 경로
UNET_PATH = "./data/captcha-model/line_removal_unet_best.keras"
CTC_PATH = "./data/captcha-model/captcha_ctc_inference.keras"

# 설정
IMG_WIDTH = 120
IMG_HEIGHT = 40
CHARACTERS = "0123456789 -"  # CTC blank 포함


def load_models():
    """모델 로드"""
    print("모델 로딩 중...")
    unet = keras.models.load_model(UNET_PATH, compile=False)
    ctc = keras.models.load_model(CTC_PATH, compile=False)
    print("✅ 모델 로딩 완료")
    return unet, ctc


def preprocess(image_path):
    """이미지 전처리"""
    img = Image.open(image_path).convert('L')
    img = img.resize((IMG_WIDTH, IMG_HEIGHT))
    img_array = np.array(img) / 255.0
    return img_array[np.newaxis, ..., np.newaxis].astype(np.float32)


def ctc_decode(prediction):
    """CTC 디코딩"""
    # Greedy decoding
    pred_indices = np.argmax(prediction[0], axis=-1)

    # 중복 제거 및 blank 제거 (마지막 인덱스가 blank)
    result = []
    prev = -1
    blank_idx = 10  # 0-9 다음이 blank

    for idx in pred_indices:
        if idx != prev and idx < blank_idx:
            result.append(str(idx))
        prev = idx

    return ''.join(result)


def predict(unet, ctc, image_path):
    """예측 실행"""
    # 전처리
    img = preprocess(image_path)

    # U-Net으로 선 제거
    cleaned = unet.predict(img, verbose=0)

    # CTC 모델로 인식
    pred = ctc.predict(cleaned, verbose=0)

    # 디코딩
    result = ctc_decode(pred)

    return result, cleaned[0, :, :, 0]


def test_with_samples():
    """샘플 이미지로 테스트"""
    import glob

    unet, ctc = load_models()

    # 테스트 이미지 찾기
    test_images = glob.glob("data/captcha-training/*.png")[:10]

    if not test_images:
        print("테스트 이미지 없음")
        return

    print(f"\n{len(test_images)}개 샘플 테스트:")
    print("-" * 50)

    correct = 0
    for img_path in test_images:
        # 파일명에서 정답 추출
        label = os.path.basename(img_path).split('.')[0]

        # 예측
        pred, _ = predict(unet, ctc, img_path)

        # 결과
        match = "✅" if pred == label else "❌"
        if pred == label:
            correct += 1
        print(f"{match} {label} -> {pred}")

    print("-" * 50)
    print(f"정확도: {correct}/{len(test_images)} ({100*correct/len(test_images):.1f}%)")


def test_single(image_path):
    """단일 이미지 테스트"""
    unet, ctc = load_models()
    result, cleaned = predict(unet, ctc, image_path)
    print(f"인식 결과: {result}")

    # 정리된 이미지 저장
    cleaned_img = Image.fromarray((cleaned * 255).astype(np.uint8))
    cleaned_img.save("temp/cleaned_captcha.png")
    print("정리된 이미지: temp/cleaned_captcha.png")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_single(sys.argv[1])
    else:
        test_with_samples()
