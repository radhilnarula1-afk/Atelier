import os
import json
import sys
import time
import base64
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

groq_key = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY", "")
groq_key = groq_key.strip()

if not groq_key:
    print("Error: No Groq/Gemini API key found in env. Make sure GEMINI_API_KEY or GROQ_API_KEY is configured.")
    sys.exit(1)

client = Groq(api_key=groq_key)

# Strict taxonomy from train.py
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

# Pre-computed lowercase taxonomy sets for validation
TAXONOMY_SETS = {cat: set(v) for cat, v in LABEL_CLASSES.items()}

PROGRESS_FILE = "relabel_progress.json"

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Failed to load progress file: {e}")
    return {}

def save_progress(progress):
    try:
        with open(PROGRESS_FILE, "w") as f:
            json.dump(progress, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save progress file: {e}")

def encode_image(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')

def normalize_value(value, category):
    """Normalize and snap values to the closest allowed class in the taxonomy."""
    if not value or not isinstance(value, str):
        return LABEL_CLASSES[category][0]
    
    val = value.strip().lower()
    
    # Direct match
    if val in TAXONOMY_SETS[category]:
        return val
    
    # Common mappings and corrections
    if category == "print_category":
        if val in ["none", "solid", "no-print", "plain-pattern"]:
            return "plain"
        if val in ["brand logo", "logo"]:
            return "brand-logo"
        if val in ["tie dye"]:
            return "tie-dye"
    elif category == "type":
        if val in ["t-shirt", "tee", "t shirt"]:
            return "tshirt"
        if val in ["hoodie", "sweatshirt", "hoodies", "sweatshirts"]:
            return "hoodies_and_sweatshirts"
    elif category == "color":
        if val in ["off white", "cream"]:
            return "off-white"
        if val in ["dark-blue", "light-blue", "navy blue", "navy-blue"]:
            return "navy" if "navy" in val else "blue"
        if val in ["dark-grey", "light-grey", "charcoal"]:
            return "grey"
        if val in ["dark-green", "olive green"]:
            return "olive" if "olive" in val else "green"
    elif category == "theme":
        if val in ["basic", "minimalist", "minimal", "essential"]:
            return "casual"
        if val in ["grunge", "street", "hiphop", "skater"]:
            return "streetwear"
        if val in ["athletic", "activewear"]:
            return "sports"
        if val in ["business-casual", "smart-casual", "editorial"]:
            return "formal"
        if val in ["quiet-luxury", "quiet luxury"]:
            return "luxury"
    
    # Substring match check
    for allowed in LABEL_CLASSES[category]:
        if allowed in val or val in allowed:
            return allowed
            
    # Default to the first allowed class
    return LABEL_CLASSES[category][0]

def query_vision_model(image_path, raw_json_data):
    """Sends image + existing metadata context to meta-llama/llama-4-scout-17b-16e-instruct."""
    base64_image = encode_image(image_path)
    
    prompt = f"""
You are an expert fashion analyst. Your task is to analyze the clothing garment in the provided image and metadata, then map it precisely to our strict taxonomy categories.

Allowed values for each category:
{json.dumps(LABEL_CLASSES, indent=2)}

Original scrap metadata for context:
- Product Name: {raw_json_data.get('name', 'Unknown')}
- Brand: {raw_json_data.get('brand', 'Unknown')}
- Scraped Color: {raw_json_data.get('color', 'Unknown')}
- Scraped Type: {raw_json_data.get('type', 'Unknown')}
- Scraped Fit: {raw_json_data.get('fit', 'Unknown')}
- Scraped Print Category: {raw_json_data.get('print_category', 'Unknown')}
- Scraped Theme: {raw_json_data.get('theme', 'Unknown')}

Rules:
1. Examine the image carefully. Correct any errors in the scraped metadata.
2. Select exactly ONE value from each category's allowed list.
3. If the item's pattern is plain/solid color, output "plain" for print_category.
4. Output a valid JSON object ONLY, containing exactly these five keys: "type", "color", "fit", "print_category", "theme". Do not include markdown formatting, backticks, or explanatory text outside of the JSON.
"""
    
    completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        model="meta-llama/llama-4-scout-17b-16e-instruct"
    )
    
    text = completion.choices[0].message.content.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
        
    return json.loads(text)

def query_text_fallback(raw_json_data):
    """Fallback text classifier using llama-3.3-70b-versatile in case image processing fails."""
    prompt = f"""
You are an expert fashion metadata annotator. Analyze the raw product metadata and select the correct matching category tags from our taxonomy.

Allowed values for each category:
{json.dumps(LABEL_CLASSES, indent=2)}

Product Metadata:
{json.dumps(raw_json_data, indent=2)}

Rules:
1. Output a valid JSON object containing exactly these 5 keys: "type", "color", "fit", "print_category", "theme".
2. Select exactly one value from each category's allowed list.
3. No explanation or markdown format, return raw JSON string only.
"""
    completion = client.chat.completions.create(
        messages=[{"role": "user", "content": prompt}],
        model="llama-3.3-70b-versatile"
    )
    text = completion.choices[0].message.content.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
        
    return json.loads(text)

def main():
    print("==================================================")
    print("       ATELIER DATASET RELABELING ENGINE          ")
    print("==================================================")
    
    progress = load_progress()
    
    # Collect all json paths in dataset
    dataset_dir = Path("dataset")
    json_paths = list(dataset_dir.rglob("*.json"))
    
    # Filter out products.db or other non-image json if any
    json_paths = [p for p in json_paths if "products.db" not in str(p) and p.name != PROGRESS_FILE]
    
    total_files = len(json_paths)
    print(f"Total dataset files found: {total_files}")
    
    # Identify which ones need to be processed
    to_process = []
    already_completed_count = 0
    for path in json_paths:
        path_str = str(path)
        if path_str in progress and progress[path_str].get("status") == "success":
            already_completed_count += 1
        else:
            to_process.append(path)
            
    print(f"Already completed/skipped: {already_completed_count}")
    print(f"Remaining to process: {len(to_process)}")
    print("==================================================")
    
    if not to_process:
        print("\nAll files are already successfully relabeled! Nothing to do.")
        return
        
    success_count = 0
    fallback_count = 0
    error_count = 0
    
    total_to_process = len(to_process)
    start_time = time.time()
    
    for idx, json_path in enumerate(to_process, 1):
        json_str_path = str(json_path)
        item_start_time = time.time()
        
        print(f"\n[{idx}/{total_to_process}] Processing: {json_path.relative_to(dataset_dir)}")
        img_path = json_path.with_suffix(".jpg")
        
        # Load current JSON content
        try:
            with open(json_path, "r") as f:
                json_data = json.load(f)
        except Exception as e:
            print(f"  [ERROR] Failed to read JSON file: {e}")
            progress[json_str_path] = {"status": "error", "reason": f"read_error: {str(e)}"}
            save_progress(progress)
            error_count += 1
            continue
            
        labels = None
        used_fallback = False
        
        # Try vision API
        if img_path.exists():
            try:
                # Add a tiny delay to avoid hitting rate limits
                time.sleep(0.5)
                labels = query_vision_model(img_path, json_data)
                print("  [VISION] Successfully classified image.")
            except Exception as e:
                print(f"  [WARNING] Vision classification failed: {e}. Trying text fallback...")
                used_fallback = True
        else:
            print("  [INFO] Image file not found. Running text fallback...")
            used_fallback = True
            
        # Try text fallback if needed
        if used_fallback or not labels:
            try:
                time.sleep(0.5)
                labels = query_text_fallback(json_data)
                print("  [TEXT] Successfully classified metadata.")
            except Exception as e:
                print(f"  [ERROR] Text fallback classification failed: {e}")
                progress[json_str_path] = {"status": "error", "reason": f"classification_error: {str(e)}"}
                save_progress(progress)
                error_count += 1
                continue
                
        # Validate and normalize labels
        normalized_labels = {}
        for category in LABEL_CLASSES:
            val = labels.get(category)
            norm_val = normalize_value(val, category)
            normalized_labels[category] = norm_val
            
        # Update original JSON data with corrected values
        json_data.update(normalized_labels)
        json_data["relabeled_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        json_data["relabeled_by"] = "AtelierVisionEngine"
        json_data["used_fallback"] = used_fallback
        
        # Write back updated JSON
        try:
            with open(json_path, "w") as f:
                json.dump(json_data, f, indent=2)
            print(f"  [SUCCESS] Updated labels: {normalized_labels}")
            
            if used_fallback:
                fallback_count += 1
            else:
                success_count += 1
                
            progress[json_str_path] = {"status": "success", "labels": normalized_labels, "used_fallback": used_fallback}
            save_progress(progress)
        except Exception as e:
            print(f"  [ERROR] Failed to write updated JSON back: {e}")
            progress[json_str_path] = {"status": "error", "reason": f"write_error: {str(e)}"}
            save_progress(progress)
            error_count += 1
            
        # Timing & Progress Bar calculations
        elapsed = time.time() - start_time
        avg_latency = elapsed / idx
        eta = avg_latency * (total_to_process - idx)
        pct = (idx / total_to_process) * 100
        
        # Format times
        elapsed_str = time.strftime("%M:%S", time.gmtime(elapsed))
        eta_str = time.strftime("%M:%S", time.gmtime(eta)) if eta < 3600 else f"{int(eta//3600)}h {time.strftime('%M:%S', time.gmtime(eta%3600))}"
        
        # Create visual progress bar (width 30 chars)
        bar_width = 30
        filled = int(round(bar_width * idx / total_to_process))
        bar = "=" * filled + ">" + "." * (bar_width - filled - 1) if filled < bar_width else "=" * bar_width
        
        print("\n--------------------------------------------------")
        print(f"PROGRESS: [{bar}] {pct:.1f}% ({idx}/{total_to_process})")
        print(f"STATS   : Success: {success_count} | Fallback: {fallback_count} | Error: {error_count}")
        print(f"TIMING  : Elapsed: {elapsed_str} | ETA: {eta_str} | Avg Latency: {avg_latency:.2f}s")
        print("--------------------------------------------------")
        
    print("\n==================================================")
    print("           RELABELING PROCESS COMPLETED           ")
    print("==================================================")
    print(f"  * Total Dataset Files: {total_files}")
    print(f"  * Already Completed:  {already_completed_count}")
    print(f"  * Processed This Run: {total_to_process}")
    print(f"  * Successfully Updated (Vision): {success_count}")
    print(f"  * Successfully Updated (Fallback): {fallback_count}")
    print(f"  * Errors / Failed: {error_count}")
    print(f"  * Total Execution Time: {time.strftime('%M:%S', time.gmtime(time.time() - start_time))}")
    print("==================================================")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user. Progress saved.")
        sys.exit(0)
