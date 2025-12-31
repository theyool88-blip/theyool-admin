"""
Attention 모델 로딩 - Lambda 레이어 문제 해결

Lambda 레이어 대신 커스텀 레이어를 사용하여 모델을 재정의하고 가중치를 로드
"""

import os
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model

# 설정
IMG_WIDTH = 120
IMG_HEIGHT = 40
NUM_CLASSES = 10
NUM_DIGITS = 6
MODEL_PATH = "./data/captcha-model/captcha_attention_best.keras"


# 커스텀 레이어 정의 (Lambda 대체)
class ChannelAvgPool(layers.Layer):
    """Channel-wise Average Pooling"""
    def call(self, x):
        return tf.reduce_mean(x, axis=-1, keepdims=True)

    def compute_output_shape(self, input_shape):
        return input_shape[:-1] + (1,)


class ChannelMaxPool(layers.Layer):
    """Channel-wise Max Pooling"""
    def call(self, x):
        return tf.reduce_max(x, axis=-1, keepdims=True)

    def compute_output_shape(self, input_shape):
        return input_shape[:-1] + (1,)


def channel_attention(x, ratio=8):
    """Channel Attention Module"""
    channel = x.shape[-1]

    avg_pool = layers.GlobalAveragePooling2D()(x)
    max_pool = layers.GlobalMaxPooling2D()(x)

    shared_dense1 = layers.Dense(channel // ratio, activation='relu')
    shared_dense2 = layers.Dense(channel, activation='sigmoid')

    avg_out = shared_dense2(shared_dense1(avg_pool))
    max_out = shared_dense2(shared_dense1(max_pool))

    attention = layers.Add()([avg_out, max_out])
    attention = layers.Reshape((1, 1, channel))(attention)

    return layers.Multiply()([x, attention])


def spatial_attention(x, kernel_size=7):
    """Spatial Attention Module - 커스텀 레이어 사용"""
    # 커스텀 레이어 사용 (Lambda 대체)
    avg_pool = ChannelAvgPool()(x)
    max_pool = ChannelMaxPool()(x)

    concat = layers.Concatenate()([avg_pool, max_pool])
    attention = layers.Conv2D(1, kernel_size, padding='same', activation='sigmoid')(concat)

    return layers.Multiply()([x, attention])


def cbam_block(x, ratio=8):
    """CBAM: Channel + Spatial Attention"""
    x = channel_attention(x, ratio)
    x = spatial_attention(x)
    return x


def build_attention_model():
    """CBAM-enhanced CAPTCHA Recognizer"""
    inputs = layers.Input(shape=(IMG_HEIGHT, IMG_WIDTH, 1), name='image')

    # Block 1
    x = layers.Conv2D(32, 3, padding='same')(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = layers.Conv2D(32, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = cbam_block(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Dropout(0.25)(x)

    # Block 2
    x = layers.Conv2D(64, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = layers.Conv2D(64, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = cbam_block(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Dropout(0.25)(x)

    # Block 3
    x = layers.Conv2D(128, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = layers.Conv2D(128, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = cbam_block(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Dropout(0.25)(x)

    # Block 4
    x = layers.Conv2D(256, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.ReLU()(x)
    x = cbam_block(x)
    x = layers.MaxPooling2D((2, 2))(x)

    # Global features
    global_feat = layers.GlobalAveragePooling2D()(x)
    global_feat = layers.Dense(256, activation='relu')(global_feat)
    global_feat = layers.Dropout(0.5)(global_feat)

    # 6 classification heads
    outputs = []
    for i in range(NUM_DIGITS):
        h = layers.Dense(128, activation='relu')(global_feat)
        h = layers.Dropout(0.3)(h)
        h = layers.Dense(64, activation='relu')(h)
        out = layers.Dense(NUM_CLASSES, activation='softmax', name=f'digit_{i}')(h)
        outputs.append(out)

    model = Model(inputs, outputs, name='AttentionCaptchaNet')
    return model


def load_attention_model():
    """모델 로드 (가중치만)"""
    import zipfile
    import tempfile
    import h5py

    print("Attention 모델 구조 재생성 중...")
    model = build_attention_model()

    print(f"가중치 로드: {MODEL_PATH}")

    # .keras 파일에서 가중치 추출
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(MODEL_PATH, 'r') as z:
            z.extractall(tmpdir)

        weights_path = os.path.join(tmpdir, 'model.weights.h5')

        # 가중치 수동 매핑
        print("레이어별 가중치 매핑 중...")

        with h5py.File(weights_path, 'r') as f:
            layers_group = f['layers']

            # 새 모델의 레이어와 매핑
            loaded_count = 0
            for layer in model.layers:
                layer_name = layer.name

                # 가중치가 없는 레이어 스킵
                if isinstance(layer, (ChannelAvgPool, ChannelMaxPool)):
                    continue
                if not layer.weights:
                    continue

                # 저장된 가중치에서 해당 레이어 찾기
                if layer_name in layers_group:
                    vars_group = layers_group[layer_name]['vars']

                    # 가중치 순서대로 로드
                    layer_weights = []
                    var_idx = 0
                    while str(var_idx) in vars_group:
                        weight_data = vars_group[str(var_idx)][:]
                        layer_weights.append(weight_data)
                        var_idx += 1

                    if layer_weights:
                        try:
                            layer.set_weights(layer_weights)
                            loaded_count += 1
                        except Exception as e:
                            print(f"  {layer_name}: 가중치 설정 실패 - {e}")

        print(f"✅ 가중치 로드 완료! ({loaded_count}개 레이어)")

    return model


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
    import glob

    model = load_attention_model()

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
