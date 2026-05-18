"""
train.py — Fine-tune MobileNetV2 on the scraped clothing dataset
================================================================
Run this on Google Colab (free GPU) or locally.

This script uses the JSON label files produced by scraper.py.
Each image in the dataset has a matching .json file with labels:
  {
    "type": "polo",
    "color": "navy",
    "fit": "slim",
    "print_category": "geometric",
    "theme": "casual",
    ...
  }

The model is trained to predict ALL of these simultaneously
(multi-label classification via a single output head).

After training, the model is saved as: models/clothing_classifier.pt
This file is what main.py loads at startup.

Google Colab tip:
  Runtime > Change runtime type > T4 GPU (free tier)
  Then upload this project folder and run:
    !python train.py
"""

import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from torchvision.models import MobileNet_V2_Weights
from PIL import Image
from pathlib import Path

# ─── CONFIG ──────────────────────────────────────────────────────────────────

DATASET_DIR   = "dataset"
MODEL_SAVE    = "models/clothing_classifier.pt"
BATCH_SIZE    = 32
NUM_EPOCHS    = 15
LEARNING_RATE = 0.001
IMAGE_SIZE    = 224

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Training on: {DEVICE}")

# ── Label taxonomy — MUST match main.py exactly ───────────────────────────────
# If you add or remove any class here, delete the old model and retrain.

LABEL_CLASSES = {
    "type":           ["tshirt", "polo", "shirt", "hoodies_and_sweatshirts", "jacket", "jeans", "shorts"],
    "color":          ["black", "white", "navy", "grey", "red", "blue", "green",
                       "yellow", "brown", "pink", "purple", "orange", "beige",
                       "multicolor", "off-white", "maroon", "teal", "olive"],
    "fit":            ["slim", "regular", "relaxed", "oversized", "baggy"],
    "print_category": ["plain", "character", "nature", "vehicle", "figure", "sports",
                       "music", "typography", "geometric", "art", "brand-logo",
                       "food", "space", "cultural", "merchandise", "camouflage",
                       "tie-dye", "pattern"],
    "theme":          ["casual", "formal", "streetwear", "sports", "merchandise",
                       "superhero", "anime", "vintage", "nature", "luxury",
                       "typographic", "abstract", "cultural"],
}

# Pre-compute flat label → index lookup for fast encoding
LABEL_TO_IDX = {}
offset = 0
for category, classes in LABEL_CLASSES.items():
    for i, cls in enumerate(classes):
        LABEL_TO_IDX[(category, cls)] = offset + i
    offset += len(classes)

TOTAL_LABELS = sum(len(v) for v in LABEL_CLASSES.values())

# ─── DATA TRANSFORMS ─────────────────────────────────────────────────────────

train_transform = transforms.Compose([
    # High-performance Resized Crop for scale/aspect invariance
    transforms.RandomResizedCrop(IMAGE_SIZE, scale=(0.8, 1.0), ratio=(0.9, 1.1)),
    transforms.RandomHorizontalFlip(p=0.5),
    # Slight rotations and translation/scale transformations (affine)
    transforms.RandomRotation(15),
    transforms.RandomAffine(degrees=10, translate=(0.05, 0.05), scale=(0.95, 1.05)),
    # Robust color jitter for lighting & camera sensor differences
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.05),
    transforms.ToTensor(),
    # Normalize with ImageNet stats
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
    # Regularization via Random Erasing to prevent overfitting to specific patches
    transforms.RandomErasing(p=0.2, scale=(0.02, 0.1), ratio=(0.3, 3.3)),
])

val_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


# ─── CUSTOM DATASET ──────────────────────────────────────────────────────────

class ClothingDataset(Dataset):
    """
    Reads images + their JSON label files produced by scraper.py.

    Dataset folder layout (created by scraper.py):
      dataset/
        train/
          tshirt/
            0000.jpg
            0000.json   ← label file
            0001.jpg
            0001.json
          polo/
            0000.jpg
            0000.json
        val/
          ...

    Each JSON contains:
      { "type": "polo", "color": "navy", "fit": "slim", "print_category": "plain", ... }

    The Dataset converts these labels into a multi-hot target vector
    of length TOTAL_LABELS. The model learns to predict all categories
    at once from a single forward pass.
    """

    def __init__(self, split: str, transform=None):
        self.transform = transform
        self.samples = []

        split_dir = Path(DATASET_DIR) / split

        if not split_dir.exists():
            raise FileNotFoundError(
                f"Dataset split not found: {split_dir}\n"
                f"Run scraper.py first to build the dataset."
            )

        for json_path in split_dir.rglob("*.json"):
            img_path = json_path.with_suffix(".jpg")
            if not img_path.exists():
                continue

            try:
                with open(json_path) as f:
                    label_data = json.load(f)
                self.samples.append((str(img_path), label_data))
            except Exception:
                continue

        if not self.samples:
            raise RuntimeError(
                f"No valid image+json pairs found in {split_dir}.\n"
                f"Make sure scraper.py ran successfully and saved .json files."
            )

        print(f"  {split}: {len(self.samples)} samples loaded")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label_data = self.samples[idx]

        # Load image
        image = Image.open(img_path).convert("RGB")
        if self.transform:
            image = self.transform(image)

        # Build target vector: one-hot per category, concatenated
        target = torch.zeros(TOTAL_LABELS)
        for category in LABEL_CLASSES:
            value = label_data.get(category, "")
            key = (category, value)
            if key in LABEL_TO_IDX:
                target[LABEL_TO_IDX[key]] = 1.0
            else:
                # Unknown value: set first class in category as default
                first_key = (category, LABEL_CLASSES[category][0])
                target[LABEL_TO_IDX[first_key]] = 1.0

        return image, target


# ─── BUILD MODEL ─────────────────────────────────────────────────────────────

def build_model():
    """
    MobileNetV2 pretrained on ImageNet — the backbone already understands
    shapes, textures, and colors from 1.2M training images.

    We replace the final classifier with one that outputs TOTAL_LABELS logits
    — one per label across all categories (type + color + fit + print + theme).

    This is TRANSFER LEARNING: we freeze the backbone and only train
    the new classification head on our clothing-specific labels.
    After the head stabilises (a few epochs), we unfreeze all layers
    for full fine-tuning, which usually lifts accuracy further.
    """
    # Use the official weights enum — pretrained=True is deprecated in newer torchvision
    model = models.mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)

    # Phase 1: freeze everything, train only the new head
    for param in model.parameters():
        param.requires_grad = False

    # Replace final classifier layer
    model.classifier[1] = nn.Linear(model.last_channel, TOTAL_LABELS)

    # New head always needs gradients
    for param in model.classifier.parameters():
        param.requires_grad = True

    return model.to(DEVICE)


def unfreeze_backbone(model):
    """Unfreeze all layers for full fine-tuning (called after warmup epochs)."""
    for param in model.parameters():
        param.requires_grad = True
    print("  [UNLOCKED] Backbone unfrozen - full fine-tuning enabled")


# ─── TRAINING LOOP ───────────────────────────────────────────────────────────

def per_category_accuracy(output: torch.Tensor, target: torch.Tensor) -> dict:
    """
    Compute per-category accuracy by checking whether the argmax within
    each category's slice matches the ground-truth label.
    """
    accs = {}
    offset = 0
    for category, classes in LABEL_CLASSES.items():
        n = len(classes)
        pred_idx = output[:, offset:offset + n].argmax(dim=1)
        true_idx = target[:, offset:offset + n].argmax(dim=1)
        accs[category] = (pred_idx == true_idx).float().mean().item() * 100
        offset += n
    return accs


def train():
    print(f"\nLoading dataset from: {DATASET_DIR}/")
    train_dataset = ClothingDataset("train", transform=train_transform)
    val_dataset   = ClothingDataset("val",   transform=val_transform)

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True,  num_workers=2, pin_memory=True)
    val_loader   = DataLoader(val_dataset,   batch_size=BATCH_SIZE, shuffle=False, num_workers=2, pin_memory=True)

    print(f"\nBuilding model (output size: {TOTAL_LABELS} labels)")
    model = build_model()

    # We use BCEWithLogitsLoss because each category is independent:
    # the model picks one class per category, not one class globally.
    criterion = nn.BCEWithLogitsLoss()

    # Only the classifier head is being trained initially
    optimizer = optim.Adam(model.classifier.parameters(), lr=LEARNING_RATE)

    # Learning rate scheduler: halve LR if val accuracy plateaus
    # Removed verbose=True, which causes TypeError in newer PyTorch versions
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", patience=3, factor=0.5)

    WARMUP_EPOCHS = 3   # train only head for this many epochs, then unfreeze backbone

    best_val_acc = 0.0
    Path("models").mkdir(exist_ok=True)

    for epoch in range(NUM_EPOCHS):

        # Unfreeze backbone after warmup
        if epoch == WARMUP_EPOCHS:
            unfreeze_backbone(model)
            # Now train all parameters with a lower LR (don't destroy ImageNet features)
            optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE * 0.1)

        # ── Training phase ──────────────────────────────────────────────────
        model.train()
        running_loss = 0.0
        all_outputs, all_targets = [], []

        for images, targets in train_loader:
            images, targets = images.to(DEVICE), targets.to(DEVICE)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            all_outputs.append(outputs.detach().cpu())
            all_targets.append(targets.cpu())

        train_out = torch.cat(all_outputs)
        train_tgt = torch.cat(all_targets)
        train_cat_accs = per_category_accuracy(train_out, train_tgt)
        train_avg_acc = sum(train_cat_accs.values()) / len(train_cat_accs)

        # ── Validation phase ────────────────────────────────────────────────
        model.eval()
        val_outputs, val_targets = [], []

        with torch.no_grad():
            for images, targets in val_loader:
                images, targets = images.to(DEVICE), targets.to(DEVICE)
                outputs = model(images)
                val_outputs.append(outputs.cpu())
                val_targets.append(targets.cpu())

        val_out = torch.cat(val_outputs)
        val_tgt = torch.cat(val_targets)
        val_cat_accs = per_category_accuracy(val_out, val_tgt)
        val_avg_acc = sum(val_cat_accs.values()) / len(val_cat_accs)

        print(f"\nEpoch [{epoch+1:2d}/{NUM_EPOCHS}]  "
              f"Loss: {running_loss/len(train_loader):.4f}  "
              f"Train: {train_avg_acc:.1f}%  Val: {val_avg_acc:.1f}%")

        for cat, acc in val_cat_accs.items():
            print(f"    {cat:15s}: {acc:.1f}%")

        scheduler.step(val_avg_acc)

        # Save best model
        if val_avg_acc > best_val_acc:
            best_val_acc = val_avg_acc
            torch.save(model.state_dict(), MODEL_SAVE)
            print(f"  [SUCCESS] Best model saved (avg val acc: {val_avg_acc:.1f}%)")

    print(f"\n[SUCCESS] Training complete!")
    print(f"   Best average validation accuracy: {best_val_acc:.1f}%")
    print(f"   Model saved to: {MODEL_SAVE}")
    print(f"\n   Next step: python main.py")


# ─── MAIN ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    train()
