"""
실제 캡차 데이터로 처음부터 학습 (From Scratch)
"""

import os
import glob
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model

# 설정
REAL_DATA_DIR = "./data/captcha-training"
MODEL_DIR = "./data/captcha-model"

IMG_WIDTH = 120
IMG_HEIGHT = 40
NUM_CLASSES = 10
NUM_DIGITS = 6
BATCH_SIZE = 32
EPOCHS = 100

CHARACTERS = "0123456789"
char_to_num = {char: i for i, char in enumerate(CHARACTERS)}


# 커스텀 레이어
class ChannelAvgPool(layers.Layer):
    def call(self, x):
        return tf.reduce_mean(x, axis=-1, keepdims=True)
    def compute_output_shape(self, input_shape):
        return input_shape[:-1] + (1,)
    def get_config(self):
        return super().get_config()


class ChannelMaxPool(layers.Layer):
    def call(self, x):
        return tf.reduce_max(x, axis=-1, keepdims=True)
    def compute_output_shape(self, input_shape):
        return input_shape[:-1] + (1,)
    def get_config(self):
        return super().get_config()


def channel_attention(x, ratio=8):
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
    avg_pool = ChannelAvgPool()(x)
    max_pool = ChannelMaxPool()(x)
    concat = layers.Concatenate()([avg_pool, max_pool])
    attention = layers.Conv2D(1, kernel_size, padding='same', activation='sigmoid')(concat)
    return layers.Multiply()([x, attention])


def cbam_block(x, ratio=8):
    x = channel_attention(x, ratio)
    x = spatial_attention(x)
    return x


def build_model():
    """CBAM Attention 모델"""
    inputs = layers.Input(shape=(IMG_HEIGHT, IMG_WIDTH, 1), name='image')

    # Data Augmentation (실제 데이터용)
    x = layers.RandomRotation(0.05)(inputs)
    x = layers.RandomZoom(0.1)(x)
    x = layers.GaussianNoise(0.1)(x)

    # Block 1
    x = layers.Conv2D(32, 3, padding='same')(x)
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

    model = Model(inputs, outputs, name='RealCaptchaNet')
    return model


def load_data():
    """실제 캡차 데이터 로드"""
    img_paths = glob.glob(f"{REAL_DATA_DIR}/*.png")

    images = []
    labels = []

    for img_path in img_paths:
        filename = os.path.basename(img_path).replace('.png', '').split('_')[0]
        if len(filename) != 6 or not filename.isdigit():
            continue

        img = Image.open(img_path).convert('L')
        img = img.resize((IMG_WIDTH, IMG_HEIGHT))
        img_array = np.array(img) / 255.0

        images.append(img_array)
        labels.append(filename)

    images = np.array(images)[..., np.newaxis].astype(np.float32)
    return images, labels


def encode_labels(labels):
    encoded = []
    for label in labels:
        enc = [char_to_num[c] for c in label]
        encoded.append(enc)
    return np.array(encoded)


def main():
    print("=" * 60)
    print("Training CBAM Attention Model with Real CAPTCHA Data")
    print("=" * 60)

    # 데이터 로드
    print(f"\n실제 데이터 로드: {REAL_DATA_DIR}")
    images, labels = load_data()
    print(f"총 {len(images)}개 이미지")

    # 데이터 분할
    np.random.seed(42)
    indices = np.random.permutation(len(images))
    split_idx = int(len(images) * 0.9)

    train_idx = indices[:split_idx]
    val_idx = indices[split_idx:]

    X_train = images[train_idx]
    X_val = images[val_idx]
    train_labels = [labels[i] for i in train_idx]
    val_labels = [labels[i] for i in val_idx]

    Y_train = encode_labels(train_labels)
    Y_val = encode_labels(val_labels)

    Y_train_dict = {f'digit_{i}': Y_train[:, i] for i in range(NUM_DIGITS)}
    Y_val_dict = {f'digit_{i}': Y_val[:, i] for i in range(NUM_DIGITS)}

    print(f"학습: {len(X_train)}개, 검증: {len(X_val)}개")

    # 모델 빌드
    print("\n모델 빌드 중...")
    model = build_model()
    model.summary()

    # 컴파일
    model.compile(
        optimizer=keras.optimizers.AdamW(learning_rate=0.001, weight_decay=0.01),
        loss={f'digit_{i}': 'sparse_categorical_crossentropy' for i in range(NUM_DIGITS)},
        metrics={f'digit_{i}': 'accuracy' for i in range(NUM_DIGITS)}
    )

    # 콜백
    callbacks = [
        keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=15,
            restore_best_weights=True,
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=7,
            min_lr=1e-6,
            verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            f"{MODEL_DIR}/captcha_real_best.keras",
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        )
    ]

    # 학습
    print("\n" + "=" * 60)
    print(f"학습 시작 (최대 {EPOCHS} epochs)")
    print("=" * 60)

    history = model.fit(
        X_train, Y_train_dict,
        validation_data=(X_val, Y_val_dict),
        batch_size=BATCH_SIZE,
        epochs=EPOCHS,
        callbacks=callbacks,
        verbose=1
    )

    # 최종 저장
    model.save(f"{MODEL_DIR}/captcha_real_final.keras")
    print(f"\n모델 저장: {MODEL_DIR}/captcha_real_final.keras")

    # 검증 성능
    print("\n" + "=" * 60)
    print("최종 검증 성능")
    print("=" * 60)

    predictions = model.predict(X_val, verbose=0)

    correct = 0
    for i in range(len(X_val)):
        pred_label = ''.join([str(np.argmax(predictions[j][i])) for j in range(NUM_DIGITS)])
        true_label = val_labels[i]
        if pred_label == true_label:
            correct += 1

    accuracy = correct / len(X_val) * 100
    print(f"\n6자리 전체 정확도: {correct}/{len(X_val)} ({accuracy:.1f}%)")


if __name__ == "__main__":
    main()
