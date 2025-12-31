"""
CTC 학습 문제 디버깅
- vocabulary 매핑 확인
- 라벨 인코딩 확인
- CTC 입출력 차원 확인
"""

import numpy as np
from tensorflow.keras import layers
import tensorflow as tf

print("=" * 60)
print("CTC 학습 디버깅")
print("=" * 60)

# ===================================
# 1. Vocabulary 매핑 확인
# ===================================
print("\n1. Vocabulary 매핑 확인")

CHARACTERS = "0123456789"
char_to_num = layers.StringLookup(vocabulary=list(CHARACTERS), mask_token=None)
num_to_char = layers.StringLookup(
    vocabulary=char_to_num.get_vocabulary(), mask_token=None, invert=True
)

vocab = char_to_num.get_vocabulary()
print(f"\nchar_to_num vocabulary ({len(vocab)}개):")
for i, v in enumerate(vocab):
    print(f"  {i}: '{v}'")

print(f"\nnum_to_char vocabulary ({len(num_to_char.get_vocabulary())}개):")
for i, v in enumerate(num_to_char.get_vocabulary()):
    print(f"  {i}: '{v}'")

# ===================================
# 2. 라벨 인코딩 테스트
# ===================================
print("\n2. 라벨 인코딩 테스트")

test_labels = ["123456", "000000", "999999", "012345"]

for label in test_labels:
    # StringLookup으로 인코딩
    encoded = char_to_num(tf.strings.unicode_split(label, input_encoding="UTF-8"))
    print(f"\n  '{label}' → {encoded.numpy()}")

    # 다시 디코딩
    decoded = tf.strings.reduce_join(num_to_char(encoded)).numpy().decode("utf-8")
    print(f"  복원: '{decoded}'")

# ===================================
# 3. 출력 Dense 차원 분석
# ===================================
print("\n3. 출력 Dense 차원 분석")

vocab_size = len(char_to_num.get_vocabulary())
print(f"\n  vocabulary 크기: {vocab_size}")
print(f"  출력 Dense units: {vocab_size} + 2 = {vocab_size + 2}")
print(f"  (0: [UNK], 1-10: 0-9, 11: extra, 12: CTC blank)")

# ===================================
# 4. CTC Loss 테스트
# ===================================
print("\n4. CTC Loss 계산 테스트")

# 가짜 예측 (batch=1, timesteps=30, classes=13)
fake_pred = np.random.rand(1, 30, 13).astype(np.float32)
fake_pred = tf.nn.softmax(fake_pred, axis=-1)  # softmax 적용

# 라벨 (batch=1, length=6)
label = "123456"
encoded_label = char_to_num(tf.strings.unicode_split(label, input_encoding="UTF-8"))
fake_label = tf.expand_dims(encoded_label, 0)  # (1, 6)
fake_label = tf.cast(fake_label, tf.float32)

print(f"\n  예측 shape: {fake_pred.shape}")
print(f"  라벨 shape: {fake_label.shape}")
print(f"  라벨 값: {fake_label.numpy()}")

# CTC Loss 계산
input_length = tf.constant([[30]], dtype=tf.int64)
label_length = tf.constant([[6]], dtype=tf.int64)

loss = tf.keras.backend.ctc_batch_cost(fake_label, fake_pred, input_length, label_length)
print(f"  CTC Loss: {loss.numpy()}")

# ===================================
# 5. CTC 디코딩 테스트
# ===================================
print("\n5. CTC 디코딩 테스트")

# 완벽한 예측 시뮬레이션 (각 위치에 정답 문자의 확률이 높음)
perfect_pred = np.zeros((1, 30, 13), dtype=np.float32)
# "123456"을 예측하도록 설정
# vocabulary: [UNK]=0, 0=1, 1=2, 2=3, 3=4, 4=5, 5=6, 6=7, 7=8, 8=9, 9=10
# "123456" → indices: 2, 3, 4, 5, 6, 7

# 각 숫자가 5 timestep씩 차지한다고 가정
for digit_pos, digit in enumerate("123456"):
    digit_index = char_to_num(digit).numpy()[0]  # vocabulary index
    start_t = digit_pos * 5
    for t in range(start_t, start_t + 4):
        perfect_pred[0, t, digit_index] = 1.0
    # 마지막 timestep은 blank (index 12)
    perfect_pred[0, start_t + 4, 12] = 1.0

# softmax (이미 one-hot이므로 그대로)
perfect_pred = perfect_pred + 1e-8  # 안정성
perfect_pred = perfect_pred / perfect_pred.sum(axis=-1, keepdims=True)

# CTC 디코딩
input_len = np.array([30])
decoded = tf.keras.backend.ctc_decode(perfect_pred, input_length=input_len, greedy=True)[0][0]

print(f"\n  디코딩된 indices: {decoded.numpy()}")
decoded_text = tf.strings.reduce_join(num_to_char(decoded[0])).numpy().decode("utf-8")
print(f"  디코딩된 텍스트: '{decoded_text}'")

# ===================================
# 6. 문제 진단
# ===================================
print("\n" + "=" * 60)
print("문제 진단")
print("=" * 60)

print("""
주요 발견:
1. vocabulary[0] = [UNK] (unknown token)
2. 모델이 주로 [UNK]를 예측 → 불확실성이 높음
3. CTC blank token은 index 12

가능한 문제:
1. 학습 데이터 불충분 또는 품질 문제
2. 모델 용량 부족
3. 학습률 또는 에포크 수 부족
4. 이미지 전처리 문제

권장 해결책:
1. 더 많은 에포크로 학습 (patience 증가)
2. 모델 용량 증가 (LSTM units, CNN filters)
3. 데이터 증강 적용
4. 더 간단한 모델로 시작 (CNN only, 6-head)
""")
