# Full corrected scraper.py
# Myntra + Rule-based extraction + Gemini Vision enhancement
# Replace your current scraper.py completely with this file

import os
import re
import json
import time
import random
import sqlite3
import hashlib
import requests
from pathlib import Path
from PIL import Image
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
from groq import Groq
import base64

# ---------------- CONFIG ----------------

load_dotenv()
# Support both variable names for convenience
GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY", "")

if not GROQ_API_KEY:
    raise RuntimeError("API key not found in .env")

groq_client = Groq(api_key=GROQ_API_KEY)

OUTPUT_DIR = "dataset"
PRODUCTS_DB = "dataset/products.db"
TRAIN_SPLIT = 0.8
PRODUCTS_PER_CATEGORY = 60
MAX_PAGES = 8
DELAY = 2

CATEGORIES = {
    # "polo": "https://www.myntra.com/men-polo-tshirts",
    #"tshirt": "https://www.myntra.com/men-tshirts",
#     "shirt": "https://www.myntra.com/men-shirts",
#     "jeans": "https://www.myntra.com/men-jeans",
#     "shorts": "https://www.myntra.com/men-shorts",
#     "jacket": "https://www.myntra.com/men-jackets",
#     "hoodies_and_sweatshirts": "https://www.myntra.com/men-sweatshirts"
}

COLORS = [
    "black", "white", "blue", "red", "green", "yellow",
    "grey", "gray", "pink", "purple", "brown", "beige",
    "navy", "olive", "orange", "maroon"
]

MATERIALS = [
    "cotton", "polyester", "denim", "linen", "wool", "fleece", "jersey"
]

PATTERNS = [
    "solid", "printed", "striped", "checked", "graphic", "self design", "washed"
]

NECK_TYPES = [
    "round neck", "polo collar", "hooded", "v-neck", "mandarin collar", "shirt collar"
]

SLEEVE_TYPES = [
    "full sleeve", "half sleeve", "short sleeve", "sleeveless"
]

MERCH_KEYWORDS = [
    "marvel", "dc", "batman", "spiderman", "superman", "naruto", "anime",
    "pokemon", "disney", "avengers", "star wars", "one piece", "dragon ball"
]

# ---------------- HELPERS ----------------

def make_dirs(category):
    for split in ["train", "val"]:
        Path(f"{OUTPUT_DIR}/{split}/{category}").mkdir(parents=True, exist_ok=True)


def init_db():
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(PRODUCTS_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            name TEXT,
            brand TEXT,
            color TEXT,
            fit TEXT,
            material TEXT,
            pattern TEXT,
            neck_type TEXT,
            sleeve_type TEXT,
            occasion TEXT,
            style_aesthetic TEXT,
            print_category TEXT,
            print_subject TEXT,
            theme TEXT,
            is_merchandise INTEGER,
            has_logo INTEGER,
            graphic_size TEXT,
            price_inr INTEGER,
            source_url TEXT,
            image_path TEXT,
            confidence TEXT,
            source TEXT DEFAULT 'Myntra India'
        )
    """)
    conn.commit()
    conn.close()

    print(f"Database ready: {PRODUCTS_DB}")


def save_product_to_db(product):
    conn = sqlite3.connect(PRODUCTS_DB)
    conn.execute("""
        INSERT INTO products (
            type, name, brand, color, fit, material, pattern,
            neck_type, sleeve_type, occasion, style_aesthetic,
            print_category, print_subject, theme,
            is_merchandise, has_logo, graphic_size,
            price_inr, source_url, image_path,
            confidence, source
        ) VALUES (
            :type, :name, :brand, :color, :fit, :material, :pattern,
            :neck_type, :sleeve_type, :occasion, :style_aesthetic,
            :print_category, :print_subject, :theme,
            :is_merchandise, :has_logo, :graphic_size,
            :price_inr, :source_url, :image_path,
            :confidence, :source
        )
    """, product)
    conn.commit()
    conn.close()


def save_image(url, path):
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            with open(path, "wb") as f:
                f.write(r.content)
            return True
    except Exception as e:
        print("Image save failed:", e)
    return False


def find_first(text, items, default="unknown"):
    text = text.lower()
    for item in items:
        if item.lower() in text:
            return item
    return default


def is_merchandise(text):
    text = text.lower()
    return any(k in text for k in MERCH_KEYWORDS)


# ---------------- PRODUCT LINKS ----------------

def get_product_links(page, category, category_url):
    print(f"Loading: {category_url}")
    links = []
    current_page = 1

    while len(links) < PRODUCTS_PER_CATEGORY and current_page <= MAX_PAGES:
        try:
            if current_page == 1:
                print(f"Opening Page 1: {category_url}")
                page.goto(category_url, wait_until="domcontentloaded", timeout=60000)
                time.sleep(4)
            else:
                print(f"Moving to Page {current_page} using Next button...")
                next_button = page.query_selector("li.pagination-next a")
                if not next_button:
                    print("No Next button found. Stopping.")
                    break
                next_button.click()
                page.wait_for_load_state("networkidle", timeout=15000)
                time.sleep(3)

            for step in range(8):
                page.evaluate(f"window.scrollTo(0, {(step + 1) * 1200})")
                time.sleep(1)

            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(2)

            anchors = page.query_selector_all("a[href*='/buy']")
            before = len(links)

            for a in anchors:
                href = a.get_attribute("href") or ""
                if not href:
                    continue

                if not href.startswith("http"):
                    href = "https://www.myntra.com/" + href.lstrip("/")

                if "/buy" in href and href not in links:
                    links.append(href)

            found = len(links) - before
            print(f"Found {found} new links (Total: {len(links)})")

            if found == 0:
                break

            current_page += 1
            time.sleep(2)

        except Exception as e:
            print("Pagination error:", e)
            break

    return links[:PRODUCTS_PER_CATEGORY]


# ---------------- PRODUCT SCRAPE ----------------

def scrape_product(context, url):
    data = {
        "name": "",
        "description": "",
        "raw_color": "",
        "raw_material": "",
        "image_url": "",
        "price_inr": 999
    }

    page = context.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=40000)
        time.sleep(3)

        body = page.inner_text("body")
        title = page.title().strip()
        
        if title.startswith("Buy "):
            title = title[4:].strip()
        if " | Myntra" in title:
            title = title.replace(" | Myntra", "")

        data["name"] = title
        data["description"] = body[:1500]

        combined = (title + " " + body[:1000]).lower()
        data["raw_color"] = find_first(combined, COLORS)
        data["raw_material"] = find_first(combined, MATERIALS)

        price_match = re.search(r"(?:₹|Rs\.?|INR)\s*([\d,]+)", body)
        if price_match:
            data["price_inr"] = int(price_match.group(1).replace(",", ""))

        # Try OpenGraph image first (best quality, always the product)
        og_img = page.query_selector('meta[property="og:image"]')
        if og_img:
            data["image_url"] = og_img.get_attribute("content") or ""

        # Fallback to Myntassets product images
        if not data["image_url"]:
            imgs = page.query_selector_all("img")
            for img in imgs:
                src = img.get_attribute("src") or ""
                if "assets.myntassets.com" in src and "/images/" in src:
                    if any(ext in src.lower() for ext in [".jpg", ".jpeg", ".webp", ".png"]):
                        data["image_url"] = src
                        break

    except Exception as e:
        print("Product scrape failed:", e)
    finally:
        page.close()

    return data


# ---------------- GROQ VISION ----------------

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def groq_label(product_name, description, image_path):
    prompt = f"""
Analyze BOTH the clothing image and text.
Use image first for visual decisions.
Return ONLY valid JSON.

Product: {product_name}
Description: {description}

Required fields:
color
print_category
print_subject
theme
has_logo
graphic_size
occasion
style_aesthetic
confidence
"""

    for attempt in range(3):
        try:
            base64_image = encode_image(image_path)
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}",
                                },
                            },
                        ],
                    }
                ],
                model="meta-llama/llama-4-scout-17b-16e-instruct",
            )
            text = chat_completion.choices[0].message.content.strip()
            # Clean up markdown JSON formatting if present
            text = text.replace("```json", "").replace("```", "").strip()
            # Groq might output text before/after JSON
            if "{" in text and "}" in text:
                text = text[text.find("{"):text.rfind("}")+1]
            return json.loads(text)
        except Exception as e:
            err_str = str(e).lower()
            if "429" in err_str or "rate limit" in err_str:
                print(f"Groq API rate limit hit. Pausing for 20s... (Attempt {attempt+1}/3)")
                time.sleep(20)
            else:
                print("Groq Vision failed:", e)
                return {}
    return {}


# ---------------- LABEL BUILD ----------------

def build_labels(title, description, image_path):
    combined = (title + " " + description).lower()

    labels = {
        "brand": title.split()[0] if title else "unknown",
        "color": find_first(combined, COLORS),
        "fit": "regular",
        "material": find_first(combined, MATERIALS),
        "pattern": find_first(combined, PATTERNS, "solid"),
        "neck_type": find_first(combined, NECK_TYPES, "regular"),
        "sleeve_type": find_first(combined, SLEEVE_TYPES, "regular"),
        "occasion": "casual",
        "style_aesthetic": "casual",
        "print_category": "plain",
        "print_subject": "none",
        "theme": "casual",
        "is_merchandise": is_merchandise(combined),
        "has_logo": False,
        "graphic_size": "none",
        "confidence": "medium"
    }

    ai = groq_label(title, description, image_path)
    if ai:
        for k, v in ai.items():
            if v in [None, ""]:
                continue
            if isinstance(v, list) and len(v) > 0:
                labels[k] = str(v[0])
            elif not isinstance(v, list):
                labels[k] = str(v)

    return labels


# ---------------- CATEGORY PROCESS ----------------

def process_category(context, category, url):
    print(f"\n===== {category.upper()} =====")
    make_dirs(category)

    page = context.new_page()
    product_links = get_product_links(page, category, url)
    page.close()

    if not product_links:
        print("No products found")
        return

    random.shuffle(product_links)
    split_index = int(len(product_links) * TRAIN_SPLIT)
    saved = 0
    seen_urls = set()

    for i, product_url in enumerate(product_links):
        if product_url in seen_urls:
            continue
        seen_urls.add(product_url)

        split = "train" if i < split_index else "val"
        file_id = f"{saved:04d}"
        img_path = f"{OUTPUT_DIR}/{split}/{category}/{file_id}.jpg"
        json_path = f"{OUTPUT_DIR}/{split}/{category}/{file_id}.json"

        raw = scrape_product(context, product_url)
        if not raw["name"]:
            continue

        if category == "hoodie" and "hoodie" not in raw["name"].lower():
            print(f"Skipping: {raw['name'][:50]} (Not a hoodie)")
            continue

        if not raw["image_url"] or not save_image(raw["image_url"], img_path):
            print("Skipping image failure")
            continue

        print(f"Name: {raw['name'][:70]}")
        print("Building labels...")

        labels = build_labels(raw["name"], raw["description"], img_path)

        def _to_int(val):
            if isinstance(val, str):
                return 1 if val.lower() in ['true', 'yes', '1', 'y', 't'] else 0
            return int(bool(val))

        final = {
            "type": category,
            "name": raw["name"],
            "brand": labels["brand"],
            "color": labels["color"],
            "fit": labels["fit"],
            "material": labels["material"],
            "pattern": labels["pattern"],
            "neck_type": labels["neck_type"],
            "sleeve_type": labels["sleeve_type"],
            "occasion": labels["occasion"],
            "style_aesthetic": labels["style_aesthetic"],
            "print_category": labels["print_category"],
            "print_subject": labels["print_subject"],
            "theme": labels["theme"],
            "is_merchandise": _to_int(labels["is_merchandise"]),
            "has_logo": _to_int(labels["has_logo"]),
            "graphic_size": labels["graphic_size"],
            "price_inr": raw["price_inr"],
            "source_url": product_url,
            "image_path": img_path,
            "confidence": labels["confidence"],
            "source": "Myntra India"
        }

        with open(json_path, "w") as f:
            json.dump(final, f, indent=2)

        save_product_to_db(final)

        print(f"Saved: {img_path}")
        saved += 1
        time.sleep(DELAY)


# ---------------- MAIN ----------------

def main():
    print("Myntra + Rule-based + Gemini Vision Scraper Started")
    init_db()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1280, "height": 800})

        for category, url in CATEGORIES.items():
            process_category(context, category, url)

        browser.close()

    print("Done. Next step: python train.py")


if __name__ == "__main__":
    main()
