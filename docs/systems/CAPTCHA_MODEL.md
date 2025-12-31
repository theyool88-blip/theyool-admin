# CAPTCHA 인식 모델 (CBAM Multi-Head V2)

## 개요

법원 나의사건검색 CAPTCHA 인식을 위한 딥러닝 모델입니다.

- **프레임워크**: PyTorch
- **아키텍처**: CBAM + Multi-Head CNN (Position-Aware Pooling)
- **정확도**: 98.47% (6자리 전체 일치)
- **자리별 정확도**: 99.4% ~ 99.9%

## 파일 구조

```
scripts/
├── cbam_multihead_v2.py      # 모델 정의
└── train_multihead_v2.py     # 학습 스크립트

data/
├── captcha-training/         # 학습 데이터 (3,324개)
└── captcha-model/
    ├── cbam_multihead_v2_final.pth    # 최종 모델 (5.3MB)
    ├── checkpoints/v2_best.pth        # 체크포인트 (16MB)
    └── training_log_v2_*.json         # 학습 로그
```

## 모델 아키텍처

### 전체 구조

```
Input (1, 50, 160)  # Grayscale, Height=50, Width=160
    ↓
ConvBlock1 (32) + CBAM → (32, 25, 80)
ConvBlock2 (64) + CBAM → (64, 12, 40)
ConvBlock3 (128) + CBAM → (128, 6, 20)
ConvBlock4 (256) + CBAM → (256, 3, 10)
    ↓
Position-Aware Pooling → (256, 1, 6)  ★ 핵심!
    ↓
6 x DigitHead → 6 x (10,)  # 각 자리별 독립 분류
```

### 핵심 컴포넌트

#### 1. CBAM (Convolutional Block Attention Module)
- **Channel Attention**: 어떤 채널이 중요한지 학습
- **Spatial Attention**: 어떤 위치가 중요한지 학습

#### 2. Position-Aware Pooling (핵심 혁신)
```python
# 기존 (실패): Global Average Pooling
self.gap = nn.AdaptiveAvgPool2d(1)  # 위치 정보 손실!

# 개선 (성공): Position-Aware Pooling
self.position_pool = nn.AdaptiveAvgPool2d((1, 6))  # 6개 위치 보존!
```

이 변경으로 각 Head가 해당 위치의 feature만 학습할 수 있게 됨.

#### 3. 6개 독립 Classification Head
- 각 자리마다 독립적인 분류기
- CrossEntropy Loss 사용 (CTC 대신)
- 고정 6자리 출력 보장

### 파라미터
- **전체 파라미터**: 1,389,988개 (~1.4M)
- **모델 크기**: 5.3MB

## 이미지 전처리

### CAPTCHA 이미지 특성
- **원본 크기**: 120 x 40 pixels
- **형식**: RGBA (텍스트가 Alpha 채널에 저장됨)
- **특징**: 대각선 노이즈 라인

### 전처리 파이프라인

```python
def preprocess_image(image_path):
    pil_img = PILImage.open(str(image_path))

    # 1. Alpha 채널 추출 (핵심!)
    if pil_img.mode == 'RGBA':
        _, _, _, alpha = pil_img.split()
        img = np.array(alpha)
    else:
        img = np.array(pil_img.convert('L'))

    # 2. 반전 (흰 글씨 → 검정 글씨)
    inverted = 255 - img

    # 3. 리사이즈 (160x50)
    resized = cv2.resize(inverted, (160, 50))

    # 4. 정규화 [0, 1]
    normalized = resized.astype(np.float32) / 255.0

    return normalized
```

**중요**: CAPTCHA 이미지의 텍스트는 Alpha 채널에 저장되어 있음. RGB만 읽으면 글자가 보이지 않음!

## 학습

### 학습 설정
| 항목 | 값 |
|------|-----|
| 이미지 크기 | 160 x 50 |
| 배치 크기 | 32 |
| 학습률 | 1e-3 (OneCycleLR) |
| Optimizer | AdamW (weight_decay=1e-4) |
| Loss | CrossEntropy (label_smoothing=0.1) |
| Epochs | 100 (early stopping patience=20) |

### 데이터 증강
- 밝기 변형: 0.9 ~ 1.1
- Gaussian 노이즈: σ=0.02

### 학습 실행
```bash
python3 scripts/train_multihead_v2.py
```

### 학습 결과 (2024-12-31)
- **Best Epoch**: 97
- **Validation Loss**: 3.1955
- **전체 정확도**: 98.47%
- **학습 시간**: ~21분 (Apple MPS)

## 사용법

### 모델 로드
```python
import torch
from scripts.cbam_multihead_v2 import CBAM_MultiHead_V2

# 모델 생성
model = CBAM_MultiHead_V2()

# 가중치 로드
model.load_state_dict(torch.load('data/captcha-model/cbam_multihead_v2_final.pth'))
model.eval()
```

### 예측
```python
from PIL import Image
import numpy as np
import cv2

def predict_captcha(model, image_path, device='cpu'):
    # 전처리
    pil_img = Image.open(image_path)
    if pil_img.mode == 'RGBA':
        _, _, _, alpha = pil_img.split()
        img = np.array(alpha)
    else:
        img = np.array(pil_img.convert('L'))

    inverted = 255 - img
    resized = cv2.resize(inverted, (160, 50))
    normalized = resized.astype(np.float32) / 255.0

    # 텐서 변환
    tensor = torch.FloatTensor(normalized).unsqueeze(0).unsqueeze(0).to(device)

    # 예측
    with torch.no_grad():
        outputs = model(tensor)
        predictions = [torch.argmax(out, dim=1).item() for out in outputs]

    return ''.join(map(str, predictions))

# 사용
result = predict_captcha(model, 'captcha.png')
print(f"인식 결과: {result}")
```

### Confidence 확인
```python
# 예측과 신뢰도 함께 반환
predictions, confidences = model.predict_with_confidence(tensor)
print(f"예측: {predictions[0].tolist()}")
print(f"신뢰도: {confidences[0].tolist()}")
```

## 트러블슈팅

### 1. MPS AdaptiveAvgPool2d 오류
```
RuntimeError: Adaptive pool MPS: input sizes must be divisible by output sizes
```

**원인**: Apple Silicon MPS에서 10→6 pooling 미지원
**해결**: CPU fallback 사용
```python
device = x.device
x_cpu = x.cpu()
x_pooled = self.position_pool(x_cpu)
x = x_pooled.to(device)
```

### 2. Alpha 채널 문제
**증상**: 전처리된 이미지에 일부 숫자만 보임
**원인**: CAPTCHA 이미지가 RGBA 형식이고 텍스트가 Alpha 채널에 저장됨
**해결**: PIL로 Alpha 채널 추출

### 3. Position 학습 불균형
**증상**: Position 1만 98%, 나머지 10%
**원인**: Global Average Pooling이 위치 정보 손실
**해결**: Position-Aware Pooling으로 변경

## 성능 비교

| 모델 | 전체 정확도 | Position 1 | Position 2-6 |
|------|-------------|------------|--------------|
| CBAM-CRNN (CTC) | 5.55% | 58% | 41-58% |
| Multi-Head (GAP) | 0% | 98% | 10% |
| **Multi-Head V2 (Position-Aware)** | **98.47%** | **99.4%** | **99.5-99.9%** |

## 유지보수

### 재학습이 필요한 경우
1. CAPTCHA 형식이 변경된 경우
2. 정확도가 떨어진 경우
3. 새로운 데이터가 추가된 경우

### 재학습 절차
1. 새 데이터를 `data/captcha-training/`에 추가 (파일명 = 레이블)
2. `python3 scripts/train_multihead_v2.py` 실행
3. 모델이 자동으로 `data/captcha-model/`에 저장됨

### 데이터 추가 형식
- 파일명: `{6자리숫자}.png` (예: `123456.png`)
- 형식: PNG (RGBA 또는 Grayscale)
- 크기: 120x40 권장 (자동 리사이즈됨)

## 참고

- **학습 데이터**: 3,324개 실제 CAPTCHA 이미지
- **개발 기간**: 2024-12-31
- **개발 환경**: macOS, Apple M-series (MPS)
