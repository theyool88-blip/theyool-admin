"""
U-Net 기반 선 제거 모델

입력: 대각선이 있는 CAPTCHA (40x120x1)
출력: 깨끗한 CAPTCHA (40x120x1)

Loss: L1 + SSIM (구조적 유사도)
"""

import os
import glob
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model

# 설정
CLEAN_DIR = "./data/captcha-pairs/clean"
LINED_DIR = "./data/captcha-pairs/lined"
MODEL_DIR = "./data/captcha-model"
os.makedirs(MODEL_DIR, exist_ok=True)

IMG_WIDTH = 120
IMG_HEIGHT = 40
BATCH_SIZE = 32
EPOCHS = 100


def load_pair_data(clean_dir, lined_dir, max_samples=None):
    """쌍 데이터 로드"""
    clean_paths = sorted(glob.glob(f"{clean_dir}/*.png"))

    lined_images = []
    clean_images = []

    for clean_path in clean_paths:
        filename = os.path.basename(clean_path)
        lined_path = os.path.join(lined_dir, filename)

        if not os.path.exists(lined_path):
            continue

        # 이미지 로드
        clean_img = Image.open(clean_path).convert('L')
        lined_img = Image.open(lined_path).convert('L')

        clean_img = clean_img.resize((IMG_WIDTH, IMG_HEIGHT))
        lined_img = lined_img.resize((IMG_WIDTH, IMG_HEIGHT))

        clean_arr = np.array(clean_img) / 255.0
        lined_arr = np.array(lined_img) / 255.0

        clean_images.append(clean_arr)
        lined_images.append(lined_arr)

        if max_samples and len(clean_images) >= max_samples:
            break

    X = np.array(lined_images)[..., np.newaxis].astype(np.float32)
    Y = np.array(clean_images)[..., np.newaxis].astype(np.float32)

    return X, Y


def build_unet():
    """
    U-Net for Line Removal

    Encoder: 특징 추출 + 다운샘플링
    Decoder: 복원 + 업샘플링
    Skip connections: 세부 정보 보존
    """
    inputs = layers.Input(shape=(IMG_HEIGHT, IMG_WIDTH, 1), name='input')

    # === Encoder ===

    # Level 1: 40x120 -> 20x60
    c1 = layers.Conv2D(32, 3, padding='same')(inputs)
    c1 = layers.BatchNormalization()(c1)
    c1 = layers.ReLU()(c1)
    c1 = layers.Conv2D(32, 3, padding='same')(c1)
    c1 = layers.BatchNormalization()(c1)
    c1 = layers.ReLU()(c1)
    p1 = layers.MaxPooling2D((2, 2))(c1)  # 20x60

    # Level 2: 20x60 -> 10x30
    c2 = layers.Conv2D(64, 3, padding='same')(p1)
    c2 = layers.BatchNormalization()(c2)
    c2 = layers.ReLU()(c2)
    c2 = layers.Conv2D(64, 3, padding='same')(c2)
    c2 = layers.BatchNormalization()(c2)
    c2 = layers.ReLU()(c2)
    p2 = layers.MaxPooling2D((2, 2))(c2)  # 10x30

    # === Bottleneck ===
    c3 = layers.Conv2D(128, 3, padding='same')(p2)
    c3 = layers.BatchNormalization()(c3)
    c3 = layers.ReLU()(c3)
    c3 = layers.Conv2D(128, 3, padding='same')(c3)
    c3 = layers.BatchNormalization()(c3)
    c3 = layers.ReLU()(c3)

    # === Decoder ===

    # Level 2: 10x30 -> 20x60
    u2 = layers.UpSampling2D((2, 2))(c3)
    u2 = layers.Concatenate()([u2, c2])  # Skip connection
    c4 = layers.Conv2D(64, 3, padding='same')(u2)
    c4 = layers.BatchNormalization()(c4)
    c4 = layers.ReLU()(c4)
    c4 = layers.Conv2D(64, 3, padding='same')(c4)
    c4 = layers.BatchNormalization()(c4)
    c4 = layers.ReLU()(c4)

    # Level 1: 20x60 -> 40x120
    u1 = layers.UpSampling2D((2, 2))(c4)
    u1 = layers.Concatenate()([u1, c1])  # Skip connection
    c5 = layers.Conv2D(32, 3, padding='same')(u1)
    c5 = layers.BatchNormalization()(c5)
    c5 = layers.ReLU()(c5)
    c5 = layers.Conv2D(32, 3, padding='same')(c5)
    c5 = layers.BatchNormalization()(c5)
    c5 = layers.ReLU()(c5)

    # Output layer
    outputs = layers.Conv2D(1, 1, activation='sigmoid', name='output')(c5)

    model = Model(inputs, outputs, name='LineRemovalUNet')
    return model


class CombinedLoss(keras.losses.Loss):
    """L1 + SSIM Loss"""

    def __init__(self, alpha=0.5, **kwargs):
        super().__init__(**kwargs)
        self.alpha = alpha

    def call(self, y_true, y_pred):
        # L1 Loss (Mean Absolute Error)
        l1 = tf.reduce_mean(tf.abs(y_true - y_pred))

        # SSIM Loss (1 - SSIM)
        ssim = tf.reduce_mean(tf.image.ssim(y_true, y_pred, max_val=1.0))
        ssim_loss = 1.0 - ssim

        return self.alpha * l1 + (1 - self.alpha) * ssim_loss


def main():
    print("=" * 60)
    print("U-Net Line Removal Model Training")
    print("=" * 60)

    # 데이터 로드
    print("\n데이터 로드 중...")
    X, Y = load_pair_data(CLEAN_DIR, LINED_DIR)
    print(f"총 {len(X)}개 쌍 데이터")
    print(f"입력 shape: {X.shape}")
    print(f"출력 shape: {Y.shape}")

    # 데이터 분할
    np.random.seed(42)
    indices = np.random.permutation(len(X))
    split_idx = int(len(X) * 0.9)

    train_idx = indices[:split_idx]
    val_idx = indices[split_idx:]

    X_train, Y_train = X[train_idx], Y[train_idx]
    X_val, Y_val = X[val_idx], Y[val_idx]

    print(f"학습: {len(X_train)}개, 검증: {len(X_val)}개")

    # 모델 빌드
    print("\n모델 빌드 중...")
    model = build_unet()
    model.summary()

    # 컴파일
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss=CombinedLoss(alpha=0.5),
        metrics=['mae']
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
            patience=5,
            min_lr=1e-6,
            verbose=1
        ),
        keras.callbacks.ModelCheckpoint(
            f"{MODEL_DIR}/line_removal_unet_best.keras",
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
        X_train, Y_train,
        validation_data=(X_val, Y_val),
        batch_size=BATCH_SIZE,
        epochs=EPOCHS,
        callbacks=callbacks,
        verbose=1
    )

    # 최종 모델 저장
    model.save(f"{MODEL_DIR}/line_removal_unet_final.keras")
    print(f"\n모델 저장 완료: {MODEL_DIR}/line_removal_unet_final.keras")

    # 검증 성능
    print("\n" + "=" * 60)
    print("검증 결과")
    print("=" * 60)

    val_loss, val_mae = model.evaluate(X_val, Y_val, verbose=0)
    print(f"검증 Loss: {val_loss:.4f}")
    print(f"검증 MAE: {val_mae:.4f}")

    # 샘플 시각화 저장
    print("\n샘플 결과 저장 중...")
    os.makedirs("./temp/unet_samples", exist_ok=True)

    sample_indices = np.random.choice(len(X_val), min(10, len(X_val)), replace=False)

    for i, idx in enumerate(sample_indices):
        input_img = X_val[idx:idx+1]
        target_img = Y_val[idx]
        pred_img = model.predict(input_img, verbose=0)[0]

        # 저장
        input_pil = Image.fromarray((input_img[0, :, :, 0] * 255).astype(np.uint8))
        target_pil = Image.fromarray((target_img[:, :, 0] * 255).astype(np.uint8))
        pred_pil = Image.fromarray((pred_img[:, :, 0] * 255).astype(np.uint8))

        input_pil.save(f"./temp/unet_samples/sample_{i}_input.png")
        target_pil.save(f"./temp/unet_samples/sample_{i}_target.png")
        pred_pil.save(f"./temp/unet_samples/sample_{i}_pred.png")

    print(f"샘플 저장 완료: ./temp/unet_samples/")


if __name__ == "__main__":
    main()
