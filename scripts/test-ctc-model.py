"""
CTC 모델 테스트 스크립트
추론 모델로 정확도 측정 및 문제 분석
"""

import os
import glob
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

# 설정
MODEL_PATH = "./data/captcha-model/captcha_ctc_inference.keras"
DATA_DIR = "./data/captcha-training"

IMG_WIDTH = 120
IMG_HEIGHT = 40
MAX_LENGTH = 6
CHARACTERS = "0123456789"

# 문자 인코딩 (학습 시와 동일)
char_to_num = layers.StringLookup(vocabulary=list(CHARACTERS), mask_token=None)
num_to_char = layers.StringLookup(
    vocabulary=char_to_num.get_vocabulary(), mask_token=None, invert=True
)


def decode_batch_predictions(pred):
    """CTC 디코딩 (Greedy Search)"""
    input_len = np.ones(pred.shape[0]) * pred.shape[1]

    # CTC decode
    results = keras.backend.ctc_decode(pred, input_length=input_len, greedy=True)[0][0]
    results = results[:, :MAX_LENGTH]

    # 숫자 → 문자 변환
    output_text = []
    for res in results:
        res = tf.strings.reduce_join(num_to_char(res)).numpy().decode("utf-8")
        res = res.replace("[UNK]", "")
        output_text.append(res)

    return output_text


def load_test_data(data_dir, max_samples=None):
    """테스트 데이터 로드"""
    img_paths = glob.glob(f"{data_dir}/*.png")

    images = []
    labels = []

    for img_path in img_paths:
        label = os.path.basename(img_path).replace('.png', '').split('_')[0]
        if len(label) != 6 or not label.isdigit():
            continue

        img = Image.open(img_path).convert('L')
        img = img.resize((IMG_WIDTH, IMG_HEIGHT))
        img_array = np.array(img) / 255.0

        images.append(img_array)
        labels.append(label)

        if max_samples and len(images) >= max_samples:
            break

    # (N, H, W) -> (N, H, W, 1)
    images = np.array(images)[..., np.newaxis].astype(np.float32)
    return images, labels


def analyze_predictions(model, images, labels, num_samples=200):
    """예측 분석"""
    print(f"\n{'='*60}")
    print(f"CTC 모델 테스트 ({num_samples}개 샘플)")
    print(f"{'='*60}")

    # 랜덤 샘플링
    np.random.seed(42)
    indices = np.random.choice(len(images), min(num_samples, len(images)), replace=False)

    test_images = images[indices]
    test_labels = [labels[i] for i in indices]

    # 예측
    print("\n예측 중...")
    preds = model.predict(test_images, verbose=0)

    print(f"\n예측 출력 shape: {preds.shape}")
    print(f"예측 범위: min={preds.min():.4f}, max={preds.max():.4f}")

    # CTC 디코딩
    pred_texts = decode_batch_predictions(preds)

    # 정확도 계산
    correct = 0
    char_correct = [0] * MAX_LENGTH
    confusion = {}
    wrong_samples = []

    for pred, true in zip(pred_texts, test_labels):
        if pred == true:
            correct += 1
        else:
            wrong_samples.append((true, pred))

        # 자리별 분석
        for i in range(min(len(pred), len(true), MAX_LENGTH)):
            if i < len(pred) and i < len(true):
                if pred[i] == true[i]:
                    char_correct[i] += 1
                else:
                    key = f"{true[i]}→{pred[i]}"
                    confusion[key] = confusion.get(key, 0) + 1

    # 결과 출력
    accuracy = correct / num_samples * 100
    print(f"\n전체 정확도: {correct}/{num_samples} ({accuracy:.1f}%)")

    print(f"\n자리별 정확도:")
    for i in range(MAX_LENGTH):
        char_acc = char_correct[i] / num_samples * 100
        bar = '█' * int(char_acc // 5) + '░' * (20 - int(char_acc // 5))
        print(f"  {i+1}번째 자리: {bar} {char_acc:.1f}%")

    # 예측 길이 분포
    pred_lengths = [len(p) for p in pred_texts]
    print(f"\n예측 길이 분포:")
    for length in range(0, 10):
        count = pred_lengths.count(length)
        if count > 0:
            print(f"  길이 {length}: {count}개 ({count/len(pred_lengths)*100:.1f}%)")

    # 상위 혼동 패턴
    if confusion:
        print(f"\n주요 혼동 패턴 (상위 15개):")
        sorted_confusion = sorted(confusion.items(), key=lambda x: x[1], reverse=True)[:15]
        for pattern, count in sorted_confusion:
            print(f"  {pattern}: {count}회")

    # 틀린 샘플 예시
    if wrong_samples:
        print(f"\n틀린 샘플 예시 (최대 20개):")
        for true, pred in wrong_samples[:20]:
            print(f"  {true} → {pred}")

    # 첫 몇 개 샘플의 raw 예측값 확인
    print(f"\n샘플 예측 상세 분석 (첫 3개):")
    for i in range(min(3, len(test_images))):
        pred = preds[i]
        print(f"\n  샘플 {i+1} (실제: {test_labels[i]}, 예측: {pred_texts[i]}):")
        print(f"    시퀀스 길이: {pred.shape[0]}")

        # 각 timestep에서 상위 확률 문자
        for t in range(min(6, pred.shape[0])):
            top_indices = np.argsort(pred[t])[-3:][::-1]
            probs = [f"{num_to_char(idx).numpy().decode('utf-8')}({pred[t][idx]:.2f})" for idx in top_indices]
            print(f"    t={t}: {', '.join(probs)}")

    return accuracy


def main():
    print("=" * 60)
    print("CTC 모델 테스트")
    print("=" * 60)

    # 모델 로드
    print(f"\n모델 로드: {MODEL_PATH}")
    model = keras.models.load_model(MODEL_PATH, compile=False)
    model.summary()

    # 데이터 로드
    print(f"\n데이터 로드: {DATA_DIR}")
    images, labels = load_test_data(DATA_DIR)
    print(f"총 {len(images)}개 이미지")

    # 테스트
    accuracy = analyze_predictions(model, images, labels, num_samples=300)

    print(f"\n{'='*60}")
    print(f"최종 정확도: {accuracy:.1f}%")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
