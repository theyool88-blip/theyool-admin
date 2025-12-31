"""
CBAM Multi-Head V2 학습 스크립트
Position-Aware Pooling 모델 - 실제 데이터만 사용
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from PIL import Image as PILImage
import numpy as np
import cv2

# 프로젝트 경로 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cbam_multihead_v2 import CBAM_MultiHead_V2, MultiHeadLoss, calculate_accuracy, decode_predictions

# ============================================================
# 설정
# ============================================================
IMG_HEIGHT = 50
IMG_WIDTH = 160
NUM_CLASSES = 10
NUM_DIGITS = 6
BATCH_SIZE = 32

DATA_DIR = './data/captcha-training'
MODEL_DIR = './data/captcha-model'
CHECKPOINT_DIR = os.path.join(MODEL_DIR, 'checkpoints')


# ============================================================
# 전처리 함수 (Alpha 채널 추출)
# ============================================================
def preprocess_image(image_path):
    """이미지 전처리 - Alpha 채널에서 글씨 추출"""
    pil_img = PILImage.open(str(image_path))

    if pil_img.mode == 'RGBA':
        # Alpha 채널 추출 (글씨가 여기 저장됨)
        _, _, _, alpha = pil_img.split()
        img = np.array(alpha)
    elif pil_img.mode == 'LA':
        # Grayscale + Alpha
        _, alpha = pil_img.split()
        img = np.array(alpha)
    else:
        # Grayscale로 변환
        img = np.array(pil_img.convert('L'))

    # 반전: Alpha에서 흰색(255)=글씨 → 검정(0)=글씨로 변환
    inverted = 255 - img

    # 리사이즈
    resized = cv2.resize(inverted, (IMG_WIDTH, IMG_HEIGHT))

    # 정규화
    normalized = resized.astype(np.float32) / 255.0

    return normalized


# ============================================================
# 데이터셋
# ============================================================
class CaptchaDataset(Dataset):
    def __init__(self, data_dir, augment=False):
        self.data_dir = Path(data_dir)
        self.augment = augment
        self.samples = []

        # 파일 로드
        for img_path in self.data_dir.glob('*.png'):
            label = img_path.stem  # 파일명이 레이블
            if len(label) == 6 and label.isdigit():
                self.samples.append((img_path, label))

        print(f"  로드: {len(self.samples)}개 ({data_dir})")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]

        # 이미지 로드 및 전처리
        img = preprocess_image(img_path)

        # 데이터 증강
        if self.augment:
            img = self._augment(img)

        # 텐서로 변환
        img_tensor = torch.FloatTensor(img).unsqueeze(0)  # (1, H, W)

        # 레이블 (각 자리 숫자)
        label_tensor = torch.LongTensor([int(c) for c in label])  # (6,)

        return img_tensor, label_tensor

    def _augment(self, img):
        """간단한 데이터 증강"""
        # 밝기 변형
        if np.random.random() < 0.3:
            factor = np.random.uniform(0.9, 1.1)
            img = np.clip(img * factor, 0, 1)

        # 노이즈 추가
        if np.random.random() < 0.2:
            noise = np.random.normal(0, 0.02, img.shape)
            img = np.clip(img + noise, 0, 1)

        return img.astype(np.float32)


# ============================================================
# 학습 클래스
# ============================================================
class Trainer:
    def __init__(self, model, device):
        self.model = model.to(device)
        self.device = device
        self.criterion = MultiHeadLoss(label_smoothing=0.1)
        self.best_val_loss = float('inf')
        self.best_val_acc = 0

    def train_epoch(self, dataloader, optimizer, scheduler=None):
        self.model.train()
        total_loss = 0
        total_correct = 0
        total_samples = 0

        for batch_idx, (images, labels) in enumerate(dataloader):
            images = images.to(self.device)
            labels = labels.to(self.device)

            optimizer.zero_grad()
            outputs = self.model(images)
            loss, _ = self.criterion(outputs, labels)
            loss.backward()

            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=5.0)
            optimizer.step()

            total_loss += loss.item()

            # Accuracy
            full_acc, _ = calculate_accuracy(outputs, labels)
            total_correct += full_acc * images.size(0)
            total_samples += images.size(0)

        if scheduler is not None:
            scheduler.step()

        avg_loss = total_loss / len(dataloader)
        avg_acc = total_correct / total_samples
        return avg_loss, avg_acc

    def validate(self, dataloader):
        self.model.eval()
        total_loss = 0
        all_pos_accs = [0] * NUM_DIGITS
        total_correct = 0
        total_samples = 0

        with torch.no_grad():
            for images, labels in dataloader:
                images = images.to(self.device)
                labels = labels.to(self.device)

                outputs = self.model(images)
                loss, _ = self.criterion(outputs, labels)
                total_loss += loss.item()

                full_acc, pos_accs = calculate_accuracy(outputs, labels)
                total_correct += full_acc * images.size(0)
                total_samples += images.size(0)

                for i, acc in enumerate(pos_accs):
                    all_pos_accs[i] += acc * images.size(0)

        avg_loss = total_loss / len(dataloader)
        avg_acc = total_correct / total_samples
        avg_pos_accs = [acc / total_samples for acc in all_pos_accs]

        return avg_loss, avg_acc, avg_pos_accs

    def save_checkpoint(self, path, epoch, optimizer, scheduler=None):
        checkpoint = {
            'epoch': epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'best_val_loss': self.best_val_loss,
            'best_val_acc': self.best_val_acc,
        }
        if scheduler is not None:
            checkpoint['scheduler_state_dict'] = scheduler.state_dict()
        torch.save(checkpoint, path)

    def load_checkpoint(self, path):
        checkpoint = torch.load(path, map_location=self.device)
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.best_val_loss = checkpoint.get('best_val_loss', float('inf'))
        self.best_val_acc = checkpoint.get('best_val_acc', 0)
        return checkpoint


# ============================================================
# 메인 학습 함수
# ============================================================
def train(epochs=100, patience=20, lr=1e-3):
    print("=" * 60)
    print("CBAM Multi-Head V2 (Position-Aware) 학습")
    print("=" * 60)

    # Device
    if torch.cuda.is_available():
        device = torch.device('cuda')
        print(f"Device: CUDA")
    elif torch.backends.mps.is_available():
        device = torch.device('mps')
        print("Device: Apple MPS")
    else:
        device = torch.device('cpu')
        print("Device: CPU")

    # 디렉토리 생성
    os.makedirs(MODEL_DIR, exist_ok=True)
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)

    # 모델
    model = CBAM_MultiHead_V2(
        img_height=IMG_HEIGHT,
        img_width=IMG_WIDTH,
        num_digits=NUM_DIGITS,
        num_classes=NUM_CLASSES
    )
    print(f"Parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Trainer
    trainer = Trainer(model, device)

    # 데이터 로드
    full_dataset = CaptchaDataset(DATA_DIR, augment=False)

    # Train/Val 분할 (85/15)
    total = len(full_dataset)
    val_size = int(total * 0.15)
    train_size = total - val_size

    train_dataset, val_dataset = torch.utils.data.random_split(
        full_dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(42)
    )

    # 학습 데이터에만 augmentation 적용
    train_dataset.dataset.augment = True

    train_loader = DataLoader(
        train_dataset, batch_size=BATCH_SIZE, shuffle=True,
        num_workers=0, pin_memory=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=BATCH_SIZE, shuffle=False,
        num_workers=0, pin_memory=True
    )

    print(f"  Train: {train_size}, Val: {val_size}")

    # Optimizer & Scheduler
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.OneCycleLR(
        optimizer,
        max_lr=lr,
        epochs=epochs,
        steps_per_epoch=len(train_loader),
        pct_start=0.1,
        anneal_strategy='cos'
    )

    print(f"\n  학습 시작 (최대 {epochs} epochs, patience={patience})")
    print("-" * 60)

    best_epoch = 0
    no_improve = 0
    history = []

    for epoch in range(1, epochs + 1):
        start_time = time.time()

        # Train
        train_loss, train_acc = trainer.train_epoch(train_loader, optimizer, scheduler)

        # Validate
        val_loss, val_acc, pos_accs = trainer.validate(val_loader)

        elapsed = time.time() - start_time
        current_lr = optimizer.param_groups[0]['lr']

        # Position accuracy 평균
        avg_pos_acc = sum(pos_accs) / len(pos_accs)

        print(f"  Epoch {epoch:3d} | Loss: {val_loss:.4f} | Acc: {val_acc*100:5.1f}% | "
              f"Pos: {avg_pos_acc*100:4.1f}% | LR: {current_lr:.2e} | {elapsed:.1f}s")

        # Best model 저장
        if val_loss < trainer.best_val_loss:
            trainer.best_val_loss = val_loss
            trainer.best_val_acc = val_acc
            best_epoch = epoch
            no_improve = 0

            trainer.save_checkpoint(
                os.path.join(CHECKPOINT_DIR, 'v2_best.pth'),
                epoch, optimizer, scheduler
            )
            pos_str = [f'{acc*100:.0f}%' for acc in pos_accs]
            print(f"         -> Best! 자리별: {pos_str}")
        else:
            no_improve += 1

        # 샘플 출력 (10 epoch마다)
        if epoch % 10 == 0:
            model.eval()
            with torch.no_grad():
                sample_imgs, sample_labels = next(iter(val_loader))
                sample_imgs = sample_imgs[:3].to(device)
                sample_labels = sample_labels[:3]
                outputs = model(sample_imgs)
                preds = decode_predictions(outputs)
                actuals = [''.join(map(str, l.tolist())) for l in sample_labels]
                print(f"         샘플: {preds} vs {actuals}")

        # History 저장
        history.append({
            'epoch': epoch,
            'train_loss': train_loss,
            'val_loss': val_loss,
            'val_acc': val_acc,
            'pos_accs': pos_accs,
            'lr': current_lr
        })

        # Early stopping
        if no_improve >= patience:
            print(f"\n  Early stopping at epoch {epoch}")
            break

    print(f"\n  학습 완료! Best Epoch: {best_epoch}, "
          f"Val Loss: {trainer.best_val_loss:.4f}, Acc: {trainer.best_val_acc*100:.1f}%")

    # 최종 평가
    print("\n" + "=" * 60)
    print("최종 평가")
    print("=" * 60)

    # Best 모델 로드
    trainer.load_checkpoint(os.path.join(CHECKPOINT_DIR, 'v2_best.pth'))

    # 전체 데이터로 평가
    eval_loader = DataLoader(full_dataset, batch_size=BATCH_SIZE, shuffle=False)
    _, final_acc, final_pos_accs = trainer.validate(eval_loader)

    print(f"\n  전체 정확도: {int(final_acc * len(full_dataset))}/{len(full_dataset)} ({final_acc*100:.2f}%)")
    print(f"\n  자리별 정확도:")
    for i, acc in enumerate(final_pos_accs):
        bar = '#' * int(acc * 20) + '-' * (20 - int(acc * 20))
        print(f"    Position {i+1}: [{bar}] {acc*100:.1f}%")

    # 최종 모델 저장
    final_path = os.path.join(MODEL_DIR, 'cbam_multihead_v2_final.pth')
    torch.save(model.state_dict(), final_path)
    print(f"\n  최종 모델 저장: {final_path}")

    # 학습 로그 저장
    log_path = os.path.join(MODEL_DIR, f'training_log_v2_{datetime.now():%Y%m%d_%H%M%S}.json')
    with open(log_path, 'w') as f:
        json.dump(history, f, indent=2)
    print(f"  학습 로그 저장: {log_path}")

    print("\n" + "=" * 60)
    print("학습 완료!")
    print("=" * 60)


if __name__ == "__main__":
    train(epochs=100, patience=20, lr=1e-3)
