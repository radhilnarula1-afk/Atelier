import os
import json
import zipfile
from pathlib import Path
from PIL import Image
import numpy as np

# --- CONFIGURATION ---
ZIP_FILE_PATH = "C:/Users/rajiv/Downloads/archive.zip"
OUTPUT_DATASET_DIR = "c:/Users/rajiv/Downloads/clothes_ai/dataset"

# Strict taxonomy classes matching train.py
ALLOWED_TYPES = ["tshirt", "polo", "shirt", "hoodies_and_sweatshirts", "jacket", "jeans", "shorts"]
ALLOWED_COLORS = ["black", "white", "navy", "grey", "red", "blue", "green", "beige", "olive"]

# RGB Coordinates for color distance metric
COLOR_MAP = {
    "black": (25, 25, 25),
    "white": (240, 240, 240),
    "navy": (15, 30, 75),
    "grey": (120, 120, 120),
    "red": (180, 30, 40),
    "blue": (40, 80, 180),
    "green": (30, 120, 50),
    "beige": (225, 205, 175),
    "olive": (85, 95, 55)
}

def extract_dominant_color(pil_img):
    """
    Extracts the average color of the center region (to isolate the garment) 
    and snaps it to our allowed taxonomy colors using Euclidean distance.
    """
    try:
        # Convert to RGB and crop to center 30% to ignore background
        w, h = pil_img.size
        left = int(w * 0.35)
        top = int(h * 0.35)
        right = int(w * 0.65)
        bottom = int(h * 0.65)
        cropped = pil_img.crop((left, top, right, bottom))
        
        # Calculate mean RGB
        np_img = np.array(cropped)
        avg_rgb = np_img.mean(axis=(0, 1))
        r, g, b = avg_rgb[0], avg_rgb[1], avg_rgb[2]
        
        # Find closest pre-defined color
        best_color = "black"
        min_dist = float('inf')
        for name, rgb in COLOR_MAP.items():
            dist = (r - rgb[0])**2 + (g - rgb[1])**2 + (b - rgb[2])**2
            if dist < min_dist:
                min_dist = dist
                best_color = name
        return best_color
    except Exception:
        return "black"

def load_textures(z, split_name):
    """
    Loads upper, lower, and outer textures for a split into a single lookup dictionary.
    """
    tex_dict = {}
    for part in ["upper", "lower", "outer"]:
        path = f"datasets/texture_ann/{split_name}/{part}_fused.txt"
        try:
            content = z.read(path).decode('utf-8')
            for line in content.split('\n'):
                line = line.strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    img_name = parts[0].strip()
                    tex_idx = int(parts[1].strip())
                    tex_dict[img_name] = tex_idx
        except Exception:
            pass
    return tex_dict

def map_category_type(filename):
    """
    Deterministically maps DeepFashion-MultiModal filename prefixes to our strict types.
    """
    fn = filename.lower()
    
    # 1. Tshirt / Tees
    if "tees_tanks" in fn or "graphic_tees" in fn:
        return "tshirt"
    # 2. Shirts and Polos
    elif "shirts_polos" in fn:
        if "polo" in fn:
            return "polo"
        return "shirt"
    elif "blouses_shirts" in fn:
        return "shirt"
    # 3. Hoodies and Sweatshirts
    elif "sweatshirts_hoodies" in fn:
        return "hoodies_and_sweatshirts"
    # 4. Jackets and Coats
    elif "jackets_coats" in fn or "jackets_vests" in fn or "cardigans" in fn or "sweaters" in fn:
        return "jacket"
    # 5. Bottoms (Jeans/Shorts)
    elif "denim" in fn or "jeans" in fn or "pants" in fn or "leggings" in fn:
        return "jeans"
    elif "shorts" in fn:
        return "shorts"
    
    return "tshirt"

def main():
    zip_path = Path(ZIP_FILE_PATH)
    out_dir = Path(OUTPUT_DATASET_DIR)
    
    if not zip_path.exists():
        print(f"Error: Could not locate zip archive at {ZIP_FILE_PATH}")
        return
        
    print(f"Starting direct-from-ZIP extraction and mapping...")
    print(f"Zip Location: {zip_path}")
    print(f"Destination: {out_dir}")
    
    out_dir.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as z:
        # Load textures mappings
        train_textures = load_textures(z, "train")
        val_textures = load_textures(z, "val")
        test_textures = load_textures(z, "test")
        
        # We will parse train, val, and test splits
        splits = [
            ("train", "datasets/shape_ann/train_ann_file.txt", "datasets/train_images", train_textures),
            ("val", "datasets/shape_ann/val_ann_file.txt", "datasets/train_images", val_textures),
            ("val", "datasets/shape_ann/test_ann_file.txt", "datasets/test_images", test_textures) # Merge test into val split
        ]
        
        file_idx = 1
        
        for target_split, ann_path, img_dir_path, tex_dict in splits:
            print(f"\nProcessing annotation file: {ann_path} -> Split: {target_split}")
            try:
                ann_content = z.read(ann_path).decode('utf-8')
            except Exception as e:
                print(f"Error reading annotations {ann_path}: {e}")
                continue
                
            lines = [l.strip() for l in ann_content.split('\n') if l.strip()]
            total_lines = len(lines)
            
            print(f"Found {total_lines} lines to map.")
            
            success_count = 0
            for idx, line in enumerate(lines, 1):
                parts = line.split()
                if not parts:
                    continue
                
                img_name = parts[0].strip()
                
                # Check image existence in zip
                zip_img_path = f"{img_dir_path}/{img_name}"
                try:
                    z.getinfo(zip_img_path)
                except KeyError:
                    continue
                    
                # 1. Map type
                category = map_category_type(img_name)
                
                # 2. Extract Color directly from image RGB center-crop
                try:
                    with z.open(zip_img_path) as img_file:
                        pil_img = Image.open(img_file).convert('RGB')
                        color = extract_dominant_color(pil_img)
                except Exception:
                    color = "black"
                
                # 3. Map Texture (print_category)
                tex_idx = tex_dict.get(img_name, 7)
                if tex_idx in [0, 1]:
                    print_category = "graphic"
                elif tex_idx in [2, 4]:
                    print_category = "geometric"
                else:
                    print_category = "plain"
                    
                # 4. Map Fit
                if category == "hoodies_and_sweatshirts":
                    fit = "oversized"
                elif category in ["jeans", "jacket"]:
                    fit = "slim"
                else:
                    fit = "regular"
                    
                # 5. Map Theme
                if "suiting" in img_name.lower() or "blouses_shirts" in img_name.lower():
                    theme = "formal"
                elif category in ["tshirt", "shorts"]:
                    theme = "casual"
                elif category in ["hoodies_and_sweatshirts", "jeans"]:
                    theme = "streetwear"
                else:
                    theme = "casual"
                    
                # Setup destination structure
                dest_subfolder = out_dir / target_split / category
                dest_subfolder.mkdir(parents=True, exist_ok=True)
                
                dest_file_id = f"df1_{file_idx:05d}"
                
                # Extract image as JPEG to save space
                try:
                    with z.open(zip_img_path) as img_file:
                        with Image.open(img_file) as p_img:
                            p_img.convert('RGB').save(dest_subfolder / f"{dest_file_id}.jpg", "JPEG", quality=90)
                except Exception:
                    continue
                
                # Save JSON label coordinate
                labels = {
                    "type": category,
                    "color": color,
                    "fit": fit,
                    "print_category": print_category,
                    "theme": theme
                }
                
                with open(dest_subfolder / f"{dest_file_id}.json", "w") as jf:
                    json.dump(labels, jf, indent=2)
                    
                success_count += 1
                file_idx += 1
                
                if idx % 500 == 0 or idx == total_lines:
                    pct = (idx / total_lines) * 100
                    print(f"  [PROGRESS] Mapped {success_count}/{total_lines} ({pct:.1f}%) files for this split")
                    
    print("\n==================================================")
    print("        DATASET PIPELINE UPGRADE COMPLETED        ")
    print("==================================================")
    print(f"Your fine-tuned academic dataset is structured under: {OUTPUT_DATASET_DIR}")
    print("Direct-from-ZIP extraction, crop-based RGB color profiling, and mapping completed successfully!")

if __name__ == "__main__":
    main()
