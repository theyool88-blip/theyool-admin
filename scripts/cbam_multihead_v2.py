"""
CBAM + Multi-Head CNN 캡챠 인식 모델 v2
- Position-Aware Pooling: 위치 정보 보존
- 6개 독립 분류 헤드 (각 자리별)
- CrossEntropy Loss
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class ChannelAttention(nn.Module):
    """Channel Attention Module"""
    def __init__(self, channels, reduction=16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Sequential(
            nn.Linear(channels, channels // reduction, bias=False),
            nn.ReLU(inplace=True),
            nn.Linear(channels // reduction, channels, bias=False)
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        b, c, _, _ = x.size()
        avg_out = self.fc(self.avg_pool(x).view(b, c))
        max_out = self.fc(self.max_pool(x).view(b, c))
        attention = self.sigmoid(avg_out + max_out).view(b, c, 1, 1)
        return x * attention


class SpatialAttention(nn.Module):
    """Spatial Attention Module"""
    def __init__(self, kernel_size=7):
        super().__init__()
        padding = kernel_size // 2
        self.conv = nn.Conv2d(2, 1, kernel_size, padding=padding, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        attention = self.sigmoid(self.conv(torch.cat([avg_out, max_out], dim=1)))
        return x * attention


class CBAM(nn.Module):
    """CBAM: Convolutional Block Attention Module"""
    def __init__(self, channels, reduction=16, kernel_size=7):
        super().__init__()
        self.channel_attention = ChannelAttention(channels, reduction)
        self.spatial_attention = SpatialAttention(kernel_size)

    def forward(self, x):
        x = self.channel_attention(x)
        x = self.spatial_attention(x)
        return x


class ConvBlock(nn.Module):
    """Conv + BN + ReLU + CBAM + MaxPool + Dropout"""
    def __init__(self, in_channels, out_channels, dropout=0.25):
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(out_channels)
        self.conv2 = nn.Conv2d(out_channels, out_channels, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(out_channels)
        self.cbam = CBAM(out_channels)
        self.pool = nn.MaxPool2d(2, 2)
        self.dropout = nn.Dropout2d(dropout)

    def forward(self, x):
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = self.cbam(x)
        x = self.pool(x)
        x = self.dropout(x)
        return x


class DigitHead(nn.Module):
    """Individual classification head for one digit position"""
    def __init__(self, in_features, num_classes=10, hidden_dim=128):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(in_features, hidden_dim),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, num_classes)
        )

    def forward(self, x):
        return self.fc(x)


class CBAM_MultiHead_V2(nn.Module):
    """
    CBAM + Multi-Head CNN for 6-digit CAPTCHA (Position-Aware)

    Architecture:
        Input (1, 50, 160)
            ↓
        ConvBlock1 (32) + CBAM → (32, 25, 80)
        ConvBlock2 (64) + CBAM → (64, 12, 40)
        ConvBlock3 (128) + CBAM → (128, 6, 20)
        ConvBlock4 (256) + CBAM → (256, 3, 10)
            ↓
        Position-Aware Pooling → (256, 1, 6)  ★ 위치 정보 보존!
            ↓
        6 x DigitHead (각각 다른 위치의 feature 사용)
    """
    def __init__(self, img_height=50, img_width=160, num_digits=6, num_classes=10):
        super().__init__()

        self.num_digits = num_digits
        self.num_classes = num_classes

        # CNN Backbone with CBAM
        self.conv1 = ConvBlock(1, 32, dropout=0.1)
        self.conv2 = ConvBlock(32, 64, dropout=0.15)
        self.conv3 = ConvBlock(64, 128, dropout=0.2)
        self.conv4 = ConvBlock(128, 256, dropout=0.25)

        # Position-Aware Pooling: height=1, width=6 (하나의 열이 하나의 digit)
        self.position_pool = nn.AdaptiveAvgPool2d((1, num_digits))

        # 6 Independent Classification Heads
        # 각 Head는 256 features를 받음 (해당 위치의 pooled features)
        self.heads = nn.ModuleList([
            DigitHead(256, num_classes, hidden_dim=128)
            for _ in range(num_digits)
        ])

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.BatchNorm2d):
                nn.init.constant_(m.weight, 1)
                nn.init.constant_(m.bias, 0)
            elif isinstance(m, nn.Linear):
                nn.init.kaiming_normal_(m.weight, mode='fan_out', nonlinearity='relu')
                if m.bias is not None:
                    nn.init.constant_(m.bias, 0)

    def forward(self, x):
        # CNN Backbone
        x = self.conv1(x)  # (batch, 32, 25, 80)
        x = self.conv2(x)  # (batch, 64, 12, 40)
        x = self.conv3(x)  # (batch, 128, 6, 20)
        x = self.conv4(x)  # (batch, 256, 3, 10)

        # Position-Aware Pooling (MPS 호환을 위해 CPU fallback)
        device = x.device
        x_cpu = x.cpu()
        x_pooled = self.position_pool(x_cpu)  # (batch, 256, 1, 6)
        x = x_pooled.to(device)
        x = x.squeeze(2)  # (batch, 256, 6)

        # 6 Digit Predictions - 각 Head는 해당 위치의 feature만 사용
        outputs = []
        for i, head in enumerate(self.heads):
            pos_features = x[:, :, i]  # (batch, 256) - i번째 위치의 features
            outputs.append(head(pos_features))

        return outputs  # List of 6 tensors, each (batch, 10)

    def predict(self, x):
        """Get predicted digits"""
        outputs = self.forward(x)
        predictions = [torch.argmax(out, dim=1) for out in outputs]
        return torch.stack(predictions, dim=1)  # (batch, 6)

    def predict_with_confidence(self, x):
        """Get predictions with confidence scores"""
        outputs = self.forward(x)
        predictions = []
        confidences = []
        for out in outputs:
            probs = F.softmax(out, dim=1)
            conf, pred = torch.max(probs, dim=1)
            predictions.append(pred)
            confidences.append(conf)
        return torch.stack(predictions, dim=1), torch.stack(confidences, dim=1)


class MultiHeadLoss(nn.Module):
    """Combined loss for all 6 digit heads"""
    def __init__(self, label_smoothing=0.1):
        super().__init__()
        self.criterion = nn.CrossEntropyLoss(label_smoothing=label_smoothing)

    def forward(self, outputs, targets):
        """
        Args:
            outputs: List of 6 tensors, each (batch, 10)
            targets: Tensor (batch, 6) with digit labels 0-9
        """
        total_loss = 0
        losses = []

        for i, out in enumerate(outputs):
            loss = self.criterion(out, targets[:, i])
            losses.append(loss)
            total_loss += loss

        return total_loss, losses


def calculate_accuracy(outputs, targets):
    """
    Calculate full sequence and per-position accuracy
    """
    batch_size = targets.size(0)

    # Per-position accuracy
    pos_correct = []
    predictions = []
    for i, out in enumerate(outputs):
        pred = torch.argmax(out, dim=1)
        predictions.append(pred)
        correct = (pred == targets[:, i]).sum().item()
        pos_correct.append(correct)

    pos_accs = [c / batch_size for c in pos_correct]

    # Full sequence accuracy
    predictions = torch.stack(predictions, dim=1)  # (batch, 6)
    full_correct = (predictions == targets).all(dim=1).sum().item()
    full_acc = full_correct / batch_size

    return full_acc, pos_accs


def decode_predictions(outputs):
    """Convert model outputs to digit strings"""
    predictions = []
    for out in outputs:
        pred = torch.argmax(out, dim=1)
        predictions.append(pred)

    predictions = torch.stack(predictions, dim=1)  # (batch, 6)

    # Convert to strings
    results = []
    for i in range(predictions.size(0)):
        digits = predictions[i].tolist()
        results.append(''.join(map(str, digits)))

    return results


if __name__ == "__main__":
    # Test model
    print("=" * 60)
    print("CBAM Multi-Head V2 (Position-Aware) Model Test")
    print("=" * 60)

    model = CBAM_MultiHead_V2()
    print(f"Parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Test forward pass
    x = torch.randn(4, 1, 50, 160)
    outputs = model(x)

    print(f"\nInput shape: {x.shape}")
    print(f"Output: {len(outputs)} heads, each {outputs[0].shape}")

    # Verify position-aware pooling
    print("\n--- Position-Aware Pooling 검증 ---")
    with torch.no_grad():
        # CNN Backbone
        feat = model.conv1(x)
        feat = model.conv2(feat)
        feat = model.conv3(feat)
        feat = model.conv4(feat)
        print(f"After ConvBlocks: {feat.shape}")

        # Position-Aware Pooling
        pooled = model.position_pool(feat)
        print(f"After Position Pool: {pooled.shape}")

        pooled = pooled.squeeze(2)
        print(f"After squeeze: {pooled.shape}")

        # Check each position gets different features
        print(f"\nPosition features (첫 5개 채널):")
        for i in range(6):
            print(f"  Pos {i+1}: {pooled[0, :5, i].tolist()}")

    # Test prediction
    predictions = model.predict(x)
    print(f"\nPredictions shape: {predictions.shape}")

    # Test with confidence
    preds, confs = model.predict_with_confidence(x)
    print(f"Predictions: {preds[0].tolist()}")
    print(f"Confidences: {[f'{c:.2f}' for c in confs[0].tolist()]}")

    # Test loss
    targets = torch.randint(0, 10, (4, 6))
    criterion = MultiHeadLoss()
    total_loss, losses = criterion(outputs, targets)
    print(f"\nTotal Loss: {total_loss.item():.4f}")
    print(f"Per-head losses: {[f'{l.item():.4f}' for l in losses]}")

    # Test accuracy
    full_acc, pos_accs = calculate_accuracy(outputs, targets)
    print(f"\nFull accuracy: {full_acc*100:.1f}%")
    print(f"Position accuracies: {[f'{a*100:.1f}%' for a in pos_accs]}")

    # Test decode
    decoded = decode_predictions(outputs)
    print(f"\nDecoded: {decoded}")
