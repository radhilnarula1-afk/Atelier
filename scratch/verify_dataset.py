import os
import json
from pathlib import Path

# Taxonomies
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

def verify():
    dataset_dir = Path("dataset")
    print(f"Verifying dataset in: {dataset_dir.resolve()}")
    
    # Check both train and val directories
    splits = ["train", "val"]
    total_checked = 0
    errors = []
    
    for split in splits:
        split_dir = dataset_dir / split
        if not split_dir.exists():
            print(f"Warning: {split_dir} does not exist!")
            continue
            
        print(f"\nChecking split: {split}")
        for json_path in split_dir.rglob("*.json"):
            if "products.db" in str(json_path) or json_path.name == "relabel_progress.json":
                continue
                
            total_checked += 1
            img_path = json_path.with_suffix(".jpg")
            if not img_path.exists():
                errors.append(f"Missing image for json: {json_path}")
                continue
                
            try:
                with open(json_path, "r") as f:
                    data = json.load(f)
            except Exception as e:
                errors.append(f"JSON load error in {json_path}: {e}")
                continue
                
            # Verify categories
            for category, allowed in LABEL_CLASSES.items():
                val = data.get(category)
                if val is None:
                    errors.append(f"Missing category '{category}' in {json_path}")
                elif val not in allowed:
                    errors.append(f"Invalid value '{val}' for category '{category}' in {json_path}. Allowed: {allowed}")
                    
    print("\n==================================================")
    print("            DATASET VERIFICATION SUMMARY          ")
    print("==================================================")
    print(f"Total pairs verified: {total_checked}")
    print(f"Total issues found:   {len(errors)}")
    if errors:
        print("\nDetails of issues found:")
        for err in errors[:20]:
            print(f"  - {err}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more issues.")
    else:
        print("\n[SUCCESS] No taxonomy violations or corrupt files found!")
    print("==================================================")

if __name__ == "__main__":
    verify()
