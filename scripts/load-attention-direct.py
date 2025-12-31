"""
Attention 모델 직접 로딩 - Lambda 함수 재정의

Lambda 레이어의 함수를 미리 정의하고 custom_objects로 전달하여 로드
"""

import os
import glob
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras

# 설정
IMG_WIDTH = 120
IMG_HEIGHT = 40
NUM_DIGITS = 6
MODEL_PATH = "./data/captcha-model/captcha_attention_best.keras"

# Lambda 함수 재정의 (원본과 동일)
def spatial_avg_pool(t):
    return tf.reduce_mean(t, axis=-1, keepdims=True)

def spatial_max_pool(t):
    return tf.reduce_max(t, axis=-1, keepdims=True)

# Unsafe deserialization 허용
keras.config.enable_unsafe_deserialization()


def load_attention_model():
    """모델 로드 (Lambda 함수 복원)"""
    print(f"Attention 모델 로드: {MODEL_PATH}")

    # custom_objects에 Lambda에서 사용하는 tf 함수들 등록
    custom_objects = {
        'tf': tf,
        'reduce_mean': tf.reduce_mean,
        'reduce_max': tf.reduce_max,
    }

    try:
        model = keras.models.load_model(
            MODEL_PATH,
            compile=False,
            custom_objects=custom_objects
        )
        print("✅ 모델 로드 성공!")
        return model
    except Exception as e:
        print(f"로드 실패: {e}")
        return None


def predict_captcha(model, image_path):
    """캡차 예측"""
    img = Image.open(image_path).convert('L')
    img = img.resize((IMG_WIDTH, IMG_HEIGHT))
    img_array = np.array(img) / 255.0
    img_array = img_array[np.newaxis, ..., np.newaxis].astype(np.float32)

    predictions = model.predict(img_array, verbose=0)

    result = ''
    confidences = []
    for i in range(NUM_DIGITS):
        pred = predictions[i][0]
        digit = np.argmax(pred)
        conf = pred[digit]
        result += str(digit)
        confidences.append(conf)

    return result, confidences


def test_model():
    """모델 테스트"""
    model = load_attention_model()
    if model is None:
        return

    test_images = glob.glob("data/captcha-training/*.png")[:10]

    if not test_images:
        print("테스트 이미지 없음")
        return

    print(f"\n{len(test_images)}개 샘플 테스트:")
    print("-" * 50)

    correct = 0
    for img_path in test_images:
        label = os.path.basename(img_path).split('.')[0].split('_')[0]
        pred, confs = predict_captcha(model, img_path)

        match = "✅" if pred == label else "❌"
        if pred == label:
            correct += 1

        avg_conf = np.mean(confs) * 100
        print(f"{match} {label} -> {pred} (신뢰도: {avg_conf:.1f}%)")

    print("-" * 50)
    print(f"정확도: {correct}/{len(test_images)} ({100*correct/len(test_images):.1f}%)")

    return model


if __name__ == "__main__":
    test_model()
