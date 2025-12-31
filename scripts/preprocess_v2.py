"""
Captcha Preprocessing Pipeline v2
CBAM-CRNN 모델을 위한 전처리 파이프라인

특징:
- Grayscale 변환
- 160x50 리사이즈 (CTC 시퀀스 길이 확보)
- 모폴로지 기반 노이즈 제거
- [0, 1] 정규화
- 데이터 증강 (회전, 밝기)
"""

import cv2
import numpy as np
import torch
from PIL import Image
from typing import Tuple, List, Optional, Union
import os


# 설정
TARGET_WIDTH = 160
TARGET_HEIGHT = 50
NORMALIZE_MEAN = 0.5
NORMALIZE_STD = 0.5


class CaptchaPreprocessor:
    """캡챠 전처리 클래스"""

    def __init__(
        self,
        target_size: Tuple[int, int] = (TARGET_WIDTH, TARGET_HEIGHT),
        use_morphology: bool = True,
        normalize: bool = True,
        use_mean_std: bool = False
    ):
        """
        Args:
            target_size: (width, height) 출력 이미지 크기
            use_morphology: 모폴로지 연산으로 노이즈 제거 여부
            normalize: [0, 1] 정규화 여부
            use_mean_std: 평균/표준편차 정규화 사용 여부
        """
        self.target_size = target_size
        self.use_morphology = use_morphology
        self.normalize = normalize
        self.use_mean_std = use_mean_std

    def load_image(self, path: str) -> np.ndarray:
        """이미지 로드 (grayscale)"""
        if isinstance(path, str):
            img = Image.open(path).convert('L')
            return np.array(img)
        elif isinstance(path, np.ndarray):
            return path
        elif isinstance(path, Image.Image):
            return np.array(path.convert('L'))
        else:
            raise ValueError(f"지원하지 않는 입력 타입: {type(path)}")

    def resize(self, img: np.ndarray) -> np.ndarray:
        """이미지 리사이즈"""
        width, height = self.target_size
        return cv2.resize(img, (width, height), interpolation=cv2.INTER_LINEAR)

    def apply_morphology(self, img: np.ndarray) -> np.ndarray:
        """
        모폴로지 연산으로 노이즈 제거

        수평 커널을 사용하여:
        - 대각선 노이즈 라인의 세로 성분 제거
        - 숫자의 가로 획 보존
        """
        # 1. Otsu 이진화
        _, binary = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # 2. 반전 (문자가 흰색이 되도록)
        inverted = cv2.bitwise_not(binary)

        # 3. 수평 커널로 opening (세로 노이즈 제거)
        # 가로로 긴 커널은 세로 방향 노이즈를 제거
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 1))
        opened = cv2.morphologyEx(inverted, cv2.MORPH_OPEN, horizontal_kernel, iterations=1)

        # 4. 문자 연결을 위한 closing
        close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, close_kernel, iterations=1)

        # 5. 다시 반전 (배경이 흰색, 문자가 검은색)
        result = cv2.bitwise_not(closed)

        return result

    def apply_morphology_v2(self, img: np.ndarray) -> np.ndarray:
        """
        모폴로지 연산 버전 2 (더 공격적인 노이즈 제거)
        """
        # 1. CLAHE 대비 향상
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(img)

        # 2. 가우시안 블러로 노이즈 감소
        blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)

        # 3. 적응형 임계값 이진화
        binary = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11, 2
        )

        # 4. 모폴로지 opening
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
        opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)

        return opened

    def normalize_image(self, img: np.ndarray) -> np.ndarray:
        """이미지 정규화"""
        img = img.astype(np.float32) / 255.0

        if self.use_mean_std:
            img = (img - NORMALIZE_MEAN) / NORMALIZE_STD

        return img

    def to_tensor(self, img: np.ndarray) -> torch.Tensor:
        """numpy 배열을 PyTorch 텐서로 변환"""
        # (H, W) -> (1, H, W)
        if img.ndim == 2:
            tensor = torch.from_numpy(img).unsqueeze(0)
        else:
            tensor = torch.from_numpy(img)
        return tensor.float()

    def process(self, path: Union[str, np.ndarray, Image.Image]) -> torch.Tensor:
        """전체 전처리 파이프라인"""
        img = self.load_image(path)
        img = self.resize(img)

        if self.use_morphology:
            img = self.apply_morphology(img)

        if self.normalize:
            img = self.normalize_image(img)

        tensor = self.to_tensor(img)

        return tensor

    def process_batch(self, paths: List[str]) -> torch.Tensor:
        """배치 전처리"""
        tensors = [self.process(path) for path in paths]
        return torch.stack(tensors)

    def process_numpy(self, path: Union[str, np.ndarray, Image.Image]) -> np.ndarray:
        """
        전처리 후 numpy 배열 반환 (시각화용)
        """
        img = self.load_image(path)
        img = self.resize(img)

        if self.use_morphology:
            img = self.apply_morphology(img)

        return img


class TrainAugmentation:
    """학습용 데이터 증강"""

    def __init__(
        self,
        rotation_range: float = 2.0,
        brightness_range: Tuple[float, float] = (0.9, 1.1),
        use_rotation: bool = True,
        use_brightness: bool = True
    ):
        self.rotation_range = rotation_range
        self.brightness_range = brightness_range
        self.use_rotation = use_rotation
        self.use_brightness = use_brightness

    def random_rotation(self, img: np.ndarray) -> np.ndarray:
        """랜덤 회전 (-rotation_range ~ rotation_range도)"""
        angle = np.random.uniform(-self.rotation_range, self.rotation_range)
        h, w = img.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            img, M, (w, h),
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated

    def random_brightness(self, img: np.ndarray) -> np.ndarray:
        """랜덤 밝기 조절"""
        factor = np.random.uniform(*self.brightness_range)
        adjusted = img.astype(np.float32) * factor
        return np.clip(adjusted, 0, 255).astype(np.uint8)

    def random_noise(self, img: np.ndarray, intensity: float = 0.02) -> np.ndarray:
        """랜덤 가우시안 노이즈"""
        noise = np.random.normal(0, intensity * 255, img.shape)
        noisy = img.astype(np.float32) + noise
        return np.clip(noisy, 0, 255).astype(np.uint8)

    def __call__(self, img: np.ndarray) -> np.ndarray:
        """증강 적용"""
        if self.use_rotation:
            img = self.random_rotation(img)

        if self.use_brightness:
            img = self.random_brightness(img)

        return img


class InferencePreprocessor:
    """추론용 전처리 (증강 없음)"""

    def __init__(
        self,
        target_size: Tuple[int, int] = (TARGET_WIDTH, TARGET_HEIGHT),
        use_morphology: bool = True
    ):
        self.preprocessor = CaptchaPreprocessor(
            target_size=target_size,
            use_morphology=use_morphology,
            normalize=True,
            use_mean_std=False
        )

    def __call__(self, image_path: str) -> torch.Tensor:
        """단일 이미지 전처리"""
        return self.preprocessor.process(image_path)

    def batch(self, image_paths: List[str]) -> torch.Tensor:
        """배치 전처리"""
        return self.preprocessor.process_batch(image_paths)


def visualize_preprocessing(image_path: str, output_dir: str = "./temp"):
    """전처리 과정 시각화"""
    os.makedirs(output_dir, exist_ok=True)

    # 원본 로드
    original = Image.open(image_path).convert('L')
    original_np = np.array(original)

    # 전처리기 생성
    preprocessor = CaptchaPreprocessor(
        target_size=(TARGET_WIDTH, TARGET_HEIGHT),
        use_morphology=True,
        normalize=False
    )

    # 단계별 처리
    resized = preprocessor.resize(original_np)
    morphed = preprocessor.apply_morphology(resized)

    # 저장
    base_name = os.path.basename(image_path).replace('.png', '')
    Image.fromarray(original_np).save(f"{output_dir}/{base_name}_1_original.png")
    Image.fromarray(resized).save(f"{output_dir}/{base_name}_2_resized.png")
    Image.fromarray(morphed).save(f"{output_dir}/{base_name}_3_morphed.png")

    print(f"시각화 저장: {output_dir}/")
    print(f"  1. 원본: {original_np.shape}")
    print(f"  2. 리사이즈: {resized.shape}")
    print(f"  3. 모폴로지: {morphed.shape}")


def test_preprocessing():
    """전처리 테스트"""
    print("=" * 60)
    print("Preprocessing Test")
    print("=" * 60)

    # 샘플 이미지 찾기
    data_dir = "./data/captcha-training"
    if not os.path.exists(data_dir):
        print(f"데이터 폴더가 없습니다: {data_dir}")
        return

    sample_files = [f for f in os.listdir(data_dir) if f.endswith('.png')][:5]

    if not sample_files:
        print("샘플 파일이 없습니다.")
        return

    # 전처리기 생성
    preprocessor = CaptchaPreprocessor(
        target_size=(TARGET_WIDTH, TARGET_HEIGHT),
        use_morphology=True,
        normalize=True
    )

    print(f"\n타겟 크기: {TARGET_WIDTH}x{TARGET_HEIGHT}")
    print(f"모폴로지: {preprocessor.use_morphology}")
    print(f"정규화: {preprocessor.normalize}")

    # 테스트
    print(f"\n샘플 {len(sample_files)}개 테스트:")
    for f in sample_files:
        path = os.path.join(data_dir, f)
        tensor = preprocessor.process(path)
        print(f"  {f}: shape={tuple(tensor.shape)}, "
              f"min={tensor.min():.3f}, max={tensor.max():.3f}")

    # 시각화
    print("\n시각화 저장 중...")
    sample_path = os.path.join(data_dir, sample_files[0])
    visualize_preprocessing(sample_path, "./temp/preprocess_test")


if __name__ == "__main__":
    test_preprocessing()
