# Captcha Data Structure

## 폴더 구조

```
data/
├── captcha-training/     # 실제 법원 캡챠 데이터
├── captcha-synthetic/    # 합성 데이터 (Synthetic)
└── captcha-model/        # 학습된 모델
```

## 데이터 설명

### captcha-training/ (실제 데이터)
- **출처**: 법원 나의사건검색 캡챠
- **수집 방식**: 수동 라벨링
- **파일명 형식**: `{6자리숫자}.png` 또는 `{6자리숫자}_{순번}.png`
- **현재 개수**: ~4,600개
- **용도**: Fine-tuning, 최종 테스트

### captcha-synthetic/ (합성 데이터)
- **출처**: `scripts/generate-synthetic-captcha.py`로 생성
- **생성 규칙**:
  - 6자리 랜덤 숫자
  - 고딕 계열 폰트 (AppleGothic, AppleSDGothicNeo 등)
  - 세로선 10~15개 (1~2px 두께)
  - 약간의 회전 (-3~3도)
  - 노이즈 추가
- **파일명 형식**: `{6자리숫자}_{인덱스5자리}.png`
- **현재 개수**: 20,000개 (2024-12-29 생성)
- **용도**: 사전 학습 (Pre-training)

### captcha-model/ (모델)
- `captcha_model.keras`: CNN 다중출력 모델
- `crnn_captcha.keras`: CRNN + CTC 모델 (실패)

## 학습 전략

1. **Phase 1: 사전 학습 (Pre-training)**
   - 데이터: captcha-synthetic/ (2만 장)
   - 목표: 숫자 인식 기본 능력 학습

2. **Phase 2: 미세 조정 (Fine-tuning)**
   - 데이터: captcha-training/ (100~200장)
   - 목표: 실제 캡챠 특성 학습

## 스크립트

| 스크립트 | 설명 |
|---------|------|
| `generate-synthetic-captcha.py` | 합성 데이터 생성 |
| `train-captcha-model.py` | CNN 다중출력 모델 학습 |
| `train-crnn-captcha.py` | CRNN + CTC 모델 학습 |

## 실험 기록

| 날짜 | 모델 | 데이터 | 결과 |
|------|------|--------|------|
| 2024-12-29 | CRNN + CTC | 실제 4,594개 | 0% (실패) |
| 2024-12-29 | CNN 다중출력 | 실제 4,594개 | 75% |
