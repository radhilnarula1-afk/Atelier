"""
Wardrobe AI - Backend
"""

import io
import os
import json
import sqlite3
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
import cloudinary
import cloudinary.uploader
import base64
import uuid
import httpx
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import contextmanager

import torch
import torch.nn.functional as F
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image

import jwt
import bcrypt
from groq import Groq
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional, List

# ─── CONFIG ──────────────────────────────────────────────────────────────────

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY", "")
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not set. Some features will fail.")

MODEL_PATH   = "models/clothing_classifier.pt"
DB_PATH      = "wardrobe.db"
SECRET_KEY   = os.getenv("SECRET_KEY", "supersecret-wardrobe-key")
ALGORITHM    = "HS256"

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

MAX_IMAGE_BYTES = 8 * 1024 * 1024

# ─── SETUP ───────────────────────────────────────────────────────────────────

app = FastAPI(title="Wardrobe AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/dataset", StaticFiles(directory="dataset"), name="dataset")

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# ─── DATABASE SETUP ──────────────────────────────────────────────────────────

# Initialize Firebase Admin SDK
try:
    firebase_admin.get_app()
except ValueError:
    _firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")
    if not _firebase_json:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT env var is not set. Add it to your .env file.")
    _firebase_dict = json.loads(_firebase_json)
    cred = credentials.Certificate(_firebase_dict)
    firebase_admin.initialize_app(cred)

# Initialize Firestore Client supporting both standard (default) and custom database IDs
try:
    db = firestore.client()
    # Perform a fast query to verify database existence
    list(db.collection("users").limit(1).stream())
except Exception as e:
    if "does not exist" in str(e).lower():
        print("Standard '(default)' database not found. Falling back to database_id='default'...")
        db = firestore.client(database_id="default")
    else:
        raise e

# Configure Cloudinary
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL")
if CLOUDINARY_URL:
    cloudinary.config(cloudinary_url=CLOUDINARY_URL)

def upload_image_to_cloud(image_bytes: bytes) -> str:
    """
    Uploads image bytes directly to Cloudinary if available.
    Falls back to saving to local uploads folder if Cloudinary is not configured.
    """
    if os.getenv("CLOUDINARY_URL"):
        try:
            res = cloudinary.uploader.upload(
                image_bytes,
                folder="atelier_wardrobe",
                resource_type="image"
            )
            return res.get("secure_url", "")
        except Exception as e:
            print(f"Cloudinary upload failed: {e}")
            
    # Fallback: Save locally
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = os.path.join("uploads", filename)
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    return f"/uploads/{filename}"

# SQL Database drivers and initialization are deprecated in favor of Firebase Firestore.

# ─── AUTHENTICATION ──────────────────────────────────────────────────────────

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return str(user_id)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

class AuthRequest(BaseModel):
    username: str
    password: str

class ProfileUpdateRequest(BaseModel):
    name: str

@app.post("/auth/register")
def register(req: AuthRequest):
    # Enforce valid email format
    if not EMAIL_REGEX.match(req.username):
        raise HTTPException(status_code=400, detail="Username must be a valid email address.")
        
    docs = db.collection("users").where("username", "==", req.username).limit(1).get()
    if docs:
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")
    hashed = bcrypt.hashpw(req.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    doc_ref = db.collection("users").document()
    doc_ref.set({
        "username": req.username,
        "password_hash": hashed,
        "name": ""
    })
    token = create_access_token({"sub": doc_ref.id})
    return {"token": token, "username": req.username, "name": ""}

@app.post("/auth/login")
def login(req: AuthRequest):
    docs = db.collection("users").where("username", "==", req.username).limit(1).get()
    if not docs:
        raise HTTPException(status_code=400, detail="Invalid email or password.")
    user_doc = docs[0]
    user_data = user_doc.to_dict()
    if not bcrypt.checkpw(req.password.encode('utf-8'), user_data['password_hash'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Invalid email or password.")
    token = create_access_token({"sub": user_doc.id})
    return {"token": token, "username": user_data['username'], "name": user_data.get("name", "")}

class GoogleAuthRequest(BaseModel):
    id_token: str

@app.post("/auth/google")
def google_auth(req: GoogleAuthRequest):
    try:
        decoded_token = firebase_auth.verify_id_token(req.id_token)
        email = decoded_token.get("email")
        name = decoded_token.get("name", "")
        if not email:
            raise HTTPException(status_code=400, detail="Google token does not contain email.")
            
        docs = db.collection("users").where("username", "==", email).limit(1).get()
        if docs:
            user_doc = docs[0]
            user_id = user_doc.id
            if not user_doc.to_dict().get("name") and name:
                db.collection("users").document(user_id).update({"name": name})
        else:
            doc_ref = db.collection("users").document()
            doc_ref.set({
                "username": email,
                "password_hash": "", 
                "name": name
            })
            user_id = doc_ref.id
            
        token = create_access_token({"sub": user_id})
        return {"token": token, "username": email, "name": name}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google ID Token: {str(e)}")

@app.get("/auth/profile")
def get_profile(user_id: str = Depends(get_current_user)):
    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    user_data = doc.to_dict()
    return {
        "email": user_data.get("username"),
        "name": user_data.get("name", "")
    }

@app.post("/auth/profile")
def update_profile(req: ProfileUpdateRequest, user_id: str = Depends(get_current_user)):
    user_ref = db.collection("users").document(user_id)
    doc = user_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User not found")
    user_ref.update({
        "name": req.name
    })
    return {"message": "Profile updated successfully", "name": req.name}

# ─── WEATHER UTILS ───────────────────────────────────────────────────────────

async def get_weather(location: str):
    if not location:
        return {"weather": "Unknown", "temperature": None}
    try:
        async with httpx.AsyncClient() as client:
            # Get coordinates
            geo_res = await client.get(f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1")
            geo_data = geo_res.json()
            if not geo_data.get("results"):
                return {"weather": "Unknown", "temperature": None}
            lat = geo_data["results"][0]["latitude"]
            lon = geo_data["results"][0]["longitude"]
            
            # Get weather
            weather_res = await client.get(f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true")
            w_data = weather_res.json()
            current = w_data.get("current_weather", {})
            temp = current.get("temperature")
            wcode = current.get("weathercode", 0)
            
            # Map weather code to string
            w_map = {0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 51: "Drizzle", 61: "Rain", 71: "Snow", 95: "Thunderstorm"}
            w_str = w_map.get(wcode, "Cloudy")
            
            return {"weather": w_str, "temperature": temp}
    except Exception as e:
        print(f"Weather fetch failed: {e}")
        return {"weather": "Unknown", "temperature": None}

# ─── ML MODEL ────────────────────────────────────────────────────────────────

def build_model_head(num_outputs: int):
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = torch.nn.Linear(model.last_channel, num_outputs)
    return model

def load_model():
    if os.getenv("RENDER") == "true":
        print("Running on Render. Bypassing PyTorch model loading to conserve RAM.")
        return None
    total_labels = sum(len(v) for v in LABEL_CLASSES.values())
    model = build_model_head(total_labels)
    if Path(MODEL_PATH).exists():
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
    model.eval()
    return model

clothing_model = load_model()

image_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

def predict_labels_with_groq(image_bytes: bytes) -> dict:
    if not groq_client:
        raise ValueError("Groq client not initialized")
    
    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    
    prompt = f"""
    Analyze the clothing item in this image and classify it into the following categories:
    - type: Must be one of {LABEL_CLASSES["type"]}
    - color: Must be one of {LABEL_CLASSES["color"]}
    - fit: Must be one of {LABEL_CLASSES["fit"]}
    - print_category: Must be one of {LABEL_CLASSES["print_category"]}
    - theme: Must be one of {LABEL_CLASSES["theme"]}
    
    Respond ONLY with a valid JSON object matching this structure:
    {{
        "type": "...",
        "color": "...",
        "fit": "...",
        "print_category": "...",
        "theme": "..."
    }}
    Do not include any other text or markdown formatting.
    """
    
    response = groq_client.chat.completions.create(
        model="llama-3.2-11b-vision-preview",
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
        response_format={"type": "json_object"},
        temperature=0.0
    )
    
    result_text = response.choices[0].message.content.strip()
    return json.loads(result_text)

def predict_labels(image_bytes: bytes) -> dict:
    # 1. Try Groq Vision first (efficient, 0MB RAM, supports all formats)
    if groq_client:
        try:
            print("Attempting clothing classification via Groq Vision...")
            return predict_labels_with_groq(image_bytes)
        except Exception as e:
            print(f"Groq Vision classification failed: {e}. Falling back...")
            
    # 2. Local PyTorch model fallback (only if model was loaded and not on Render)
    if clothing_model is not None:
        try:
            print("Attempting clothing classification via local PyTorch model...")
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            tensor = image_transform(image).unsqueeze(0)
            with torch.no_grad():
                output = clothing_model(tensor)
            labels = {}
            offset = 0
            for category, classes in LABEL_CLASSES.items():
                n = len(classes)
                scores = output[0, offset : offset + n]
                probs = F.softmax(scores, dim=0)
                predicted_idx = probs.argmax().item()
                labels[category] = classes[predicted_idx]
                offset += n
            return labels
        except Exception as e:
            print(f"Local PyTorch model prediction failed: {e}. Falling back...")
            
    # 3. Static default fallback (safest fallback, 100% stable)
    print("Using static default clothing classification tags.")
    return {
        "type": "shirt",
        "color": "white",
        "fit": "regular",
        "print_category": "plain",
        "theme": "casual"
    }

# ─── ROUTES ──────────────────────────────────────────────────────────────────

class InventoryItem(BaseModel):
    type: str
    color: str
    fit: str
    material: str = "unknown"
    print_cat: str = "plain"
    theme: str = "casual"
    image_path: str = ""

@app.post("/inventory/add")
async def add_to_inventory(item: InventoryItem, user_id: str = Depends(get_current_user)):
    doc_ref = db.collection("inventory").document()
    doc_ref.set({
        "user_id": user_id,
        "type": item.type,
        "color": item.color,
        "fit": item.fit,
        "material": item.material,
        "print_cat": item.print_cat,
        "theme": item.theme,
        "image_path": item.image_path,
        "added_at": datetime.utcnow().isoformat()
    })
    return {"success": True}

@app.get("/inventory")
async def get_inventory(user_id: str = Depends(get_current_user)):
    docs = db.collection("inventory").where("user_id", "==", user_id).get()
    items = []
    for doc in docs:
        item = doc.to_dict()
        item["id"] = doc.id
        items.append(item)
    items.sort(key=lambda x: x.get("added_at", ""), reverse=True)
    return {"success": True, "inventory": items}

@app.post("/inventory/upload")
async def upload_to_inventory(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    try:
        image_bytes = await file.read()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image too large.")

        labels = predict_labels(image_bytes)
        image_url = upload_image_to_cloud(image_bytes)
            
        doc_ref = db.collection("inventory").document()
        doc_ref.set({
            "user_id": user_id,
            "type": labels.get('type', 'unknown'),
            "color": labels.get('color', 'unknown'),
            "fit": labels.get('fit', 'unknown'),
            "material": "unknown",
            "print_cat": labels.get('print_category', 'plain'),
            "theme": labels.get('theme', 'casual'),
            "image_path": image_url,
            "added_at": datetime.utcnow().isoformat()
        })
        return {"success": True, "labels": labels}
    except Exception as e:
        print(f"Inventory upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/inventory/add_custom")
async def add_custom_inventory(
    type: str = Form(...),
    color: str = Form(...),
    fit: str = Form(...),
    material: str = Form("unknown"),
    print_cat: str = Form("plain"),
    theme: str = Form("casual"),
    file: Optional[UploadFile] = File(None),
    user_id: str = Depends(get_current_user)
):
    image_path = ""
    if file:
        image_bytes = await file.read()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Image too large.")
        image_path = upload_image_to_cloud(image_bytes)
        
    doc_ref = db.collection("inventory").document()
    doc_ref.set({
        "user_id": user_id,
        "type": type,
        "color": color,
        "fit": fit,
        "material": material,
        "print_cat": print_cat,
        "theme": theme,
        "image_path": image_path,
        "added_at": datetime.utcnow().isoformat()
    })
    return {"success": True}

@app.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user_id: str = Depends(get_current_user)):
    doc_ref = db.collection("inventory").document(item_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Item not found")
    item = doc.to_dict()
    if item.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    doc_ref.delete()
    return {"success": True}

@app.get("/inventory/recommend/{item_id}")
async def recommend_for_item(item_id: str, user_id: str = Depends(get_current_user)):
    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
    doc_ref = db.collection("inventory").document(item_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Item not found")
    item = doc.to_dict()
    if item.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    item["id"] = doc.id
    
    # 2. Get complementary categories
    item_type = item["type"].lower() if item["type"] else "tshirt"
    
    if item_type in ["tshirt", "polo", "shirt", "hoodies_and_sweatshirts", "jacket"]:
        comp_categories = ["jeans", "shorts"]
    else:
        comp_categories = ["tshirt", "polo", "shirt", "hoodies_and_sweatshirts", "jacket"]
        
    # 3. Retrieve some products from dataset/products.db
    products_db_path = "dataset/products.db"
    similar_products = []
    pairing_products = []
    
    if os.path.exists(products_db_path):
        try:
            conn_p = sqlite3.connect(products_db_path)
            conn_p.row_factory = sqlite3.Row
            cursor_p = conn_p.cursor()
            
            # Retrieve similar products (same type)
            rows_similar = cursor_p.execute(
                "SELECT id, type, name, brand, color, fit, material, pattern, theme, price_inr, image_path, source_url FROM products WHERE type = ? ORDER BY RANDOM() LIMIT 20",
                (item_type,)
            ).fetchall()
            similar_products = [dict(r) for r in rows_similar]
            
            # Retrieve pairing products matching complementary categories
            for cat in comp_categories:
                rows_p = cursor_p.execute(
                    "SELECT id, type, name, brand, color, fit, material, pattern, theme, price_inr, image_path, source_url FROM products WHERE type = ? ORDER BY RANDOM() LIMIT 15",
                    (cat,)
                ).fetchall()
                pairing_products.extend([dict(r) for r in rows_p])
                
            conn_p.close()
        except Exception as e:
            print(f"Error reading products.db: {e}")
            
    if not similar_products and not pairing_products:
        raise HTTPException(status_code=400, detail="No matching items found in recommendations database.")

    # 4. Ask LLM to pick the top 3 matching pairings and top 3 similar products
    prompt = f"""
You are an expert AI fashion stylist.
The user clicked on a clothing item from their wardrobe and wants recommendations:
- "Pairings / Coordinates": different items that go perfectly with the clicked wardrobe item.
- "Similar Styles": items of the same category that look similar or represent styling alternatives.

The clicked wardrobe item:
- Type: {item['type']}
- Color: {item['color']}
- Fit: {item['fit']}
- Style/Print: {item['print_cat']}
- Theme: {item['theme']}
- Material: {item['material']}

Candidate list of "Coordinating/Pairing" products:
{json.dumps(pairing_products[:30])}

Candidate list of "Similar Style" products:
{json.dumps(similar_products[:20])}

Select exactly 3 Coordinating/Pairing products and exactly 3 Similar products from the respective lists.
Return a valid JSON object ONLY:
{{
  "reason": "Expert stylist context explaining why these pairings match and what alternative similar styles are trending",
  "pairings": [
     {{
       "id": <product id from pairings candidate list>,
       "name": "<name of the product>",
       "brand": "<brand name>",
       "color": "<color>",
       "fit": "<fit>",
       "price_inr": <price>,
       "image_path": "<image_path of the product>",
       "reason_matching": "A short, catchy line explaining why this coordinates nicely"
     }}
  ],
  "similar": [
     {{
       "id": <product id from similar candidate list>,
       "name": "<name of the product>",
       "brand": "<brand name>",
       "color": "<color>",
       "fit": "<fit>",
       "price_inr": <price>,
       "image_path": "<image_path of the product>",
       "reason_matching": "A short line explaining why this similar piece is a great alternative"
     }}
  ]
}}
"""
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        text = chat_completion.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        parsed_recs = json.loads(text)
        
        # Ensure we attach source urls if missing in LLM response
        all_candidates = pairing_products + similar_products
        id_to_url = {p['id']: p['source_url'] for p in all_candidates}
        
        for r in parsed_recs.get("pairings", []):
            p_id = r.get("id")
            if p_id in id_to_url:
                r["source_url"] = id_to_url[p_id]
                
        for r in parsed_recs.get("similar", []):
            p_id = r.get("id")
            if p_id in id_to_url:
                r["source_url"] = id_to_url[p_id]
                
        pairings = parsed_recs.get("pairings", [])
        similar = parsed_recs.get("similar", [])
        recommendations = pairings + similar
        return {
            "success": True, 
            "clicked_item": item, 
            "reason": parsed_recs.get("reason"), 
            "pairings": pairings,
            "similar": similar,
            "recommendations": recommendations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/calendar/add")
async def add_calendar_entry(
    date: str = Form(...),
    location: str = Form(""),
    mood: str = Form(""),
    notes: str = Form(""),
    file: Optional[UploadFile] = File(None),
    files: Optional[List[UploadFile]] = File(None),
    wardrobe_item_id: Optional[str] = Form(None),
    user_id: str = Depends(get_current_user)
):
    image_paths = []
    labels = {}
    
    # 1. Weather Info
    weather_info = await get_weather(location)

    # Gather all files (both legacy single 'file' and list 'files')
    all_files = []
    if files:
        all_files.extend(files)
    elif file:
        all_files.append(file)

    # 2. Determine Image and Labels
    if all_files:
        for idx, f in enumerate(all_files):
            image_bytes = await f.read()
            if len(image_bytes) > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail=f"Image {f.filename} too large.")
            
            # Predict labels for the first image
            if idx == 0:
                try:
                    labels = predict_labels(image_bytes)
                except Exception as e:
                    print(f"Prediction failed for first image: {e}")
                    labels = {}
            
            uploaded_url = upload_image_to_cloud(image_bytes)
            if uploaded_url:
                image_paths.append(uploaded_url)
                
        # Save list as serialized JSON
        image_path = json.dumps(image_paths)
    elif wardrobe_item_id:
        # Fetch item from wardrobe Firestore collection
        doc_ref = db.collection("inventory").document(wardrobe_item_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Wardrobe item not found")
        item = doc.to_dict()
        if item.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        labels = {
            "type": item.get("type", "clothing item"),
            "color": item.get("color", "unknown"),
            "fit": item.get("fit", "regular"),
            "print_category": item.get("print_cat", "plain"),
            "theme": item.get("theme", "casual")
        }
        image_path = item.get("image_path", "")
    else:
        raise HTTPException(status_code=400, detail="Must provide either an uploaded image or a wardrobe item.")

    # 3. Save to Firestore
    doc_ref = db.collection("calendar").document()
    doc_ref.set({
        "user_id": user_id,
        "date": date,
        "location": location,
        "weather": weather_info["weather"],
        "temperature": weather_info["temperature"],
        "mood": mood,
        "image_path": image_path,
        "labels": labels,
        "notes": notes
    })
        
    return {"success": True, "labels": labels, "weather": weather_info}

@app.delete("/calendar/{entry_id}")
async def delete_calendar_entry(entry_id: str, user_id: str = Depends(get_current_user)):
    doc_ref = db.collection("calendar").document(entry_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Calendar entry not found")
    entry = doc.to_dict()
    if entry.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    doc_ref.delete()
    return {"success": True}

@app.get("/calendar")
async def get_calendar(user_id: str = Depends(get_current_user)):
    docs = db.collection("calendar").where("user_id", "==", user_id).get()
    entries = []
    for doc in docs:
        entry = doc.to_dict()
        entry["id"] = doc.id
        if isinstance(entry.get("labels"), str):
            try:
                entry["labels"] = json.loads(entry["labels"])
            except:
                entry["labels"] = {}
        entries.append(entry)
    entries.sort(key=lambda x: x.get("date", ""), reverse=True)
    return {"success": True, "calendar": entries}

class RecommendDailyRequest(BaseModel):
    location: Optional[str] = "Mumbai"
    mood: Optional[str] = "casual"
    selected_item_ids: Optional[List[str]] = []

@app.post("/recommend_daily")
async def recommend_daily(req: RecommendDailyRequest, user_id: str = Depends(get_current_user)):
    if not groq_client:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
        
    loc = req.location or "Mumbai"
    # Get Weather
    weather_info = await get_weather(loc)
    
    # Get Inventory from Firestore
    docs = db.collection("inventory").where("user_id", "==", user_id).get()
    all_inventory = []
    for doc in docs:
        item = doc.to_dict()
        item["id"] = doc.id
        all_inventory.append(item)
    
    if not all_inventory:
        raise HTTPException(status_code=400, detail="Your wardrobe is empty. Add items first!")
        
    selected_items = []
    remaining_items = []
    
    if req.selected_item_ids:
        for item in all_inventory:
            if item["id"] in req.selected_item_ids:
                selected_items.append(item)
            else:
                remaining_items.append(item)
    else:
        remaining_items = all_inventory
        
    if selected_items:
        prompt = f"""
You are an expert AI fashion stylist.
The user wants to build an outfit starting with these specific items from their wardrobe:
{json.dumps(selected_items)}

Here is the rest of their wardrobe:
{json.dumps(remaining_items)}

Evaluate their selected piece(s) and create a cohesive, stylish, fully coordinated outfit.
Choose complementary items from the rest of their wardrobe (remaining items) to complete this look. If their remaining wardrobe does not contain matching complementary pieces, suggest what specific standard items or accessories they should style it with (e.g., white sneakers, black belt).

The styling context:
- Vibe / Mood: {req.mood or 'casual'}
- Local Weather: {weather_info['weather']} ({weather_info['temperature']}°C) at {loc}

Return a valid JSON object ONLY:
{{
  "outfit_name": "A high-end styling title for this combination",
  "reason": "Expert stylistic commentary detailing why the selected items work together and how the suggested additions complete the look beautifully.",
  "items": [
     {{
       "id": <id of the wardrobe item, if selected from their inventory, otherwise null>,
       "type": "type of item",
       "color": "color",
       "fit": "fit",
       "source": "wardrobe" or "stylist_suggestion"
     }}
  ]
}}
"""
    else:
        prompt = f"""
You are an expert AI fashion stylist.
Select a complete outfit for today from the user's wardrobe.
Their wardrobe:
{json.dumps(all_inventory)}

The styling context:
- Vibe / Mood: {req.mood or 'casual'}
- Local Weather: {weather_info['weather']} ({weather_info['temperature']}°C) at {loc}

Return a valid JSON object ONLY:
{{
  "outfit_name": "A high-end styling title for this combination",
  "reason": "Why this combination works beautifully for the mood and weather",
  "items": [
     {{
       "id": <id of the wardrobe item>,
       "type": "type of item",
       "color": "color",
       "fit": "fit",
       "source": "wardrobe"
     }}
  ]
}}
"""
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
        )
        text = chat_completion.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return {"success": True, "recommendation": json.loads(text), "weather": weather_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def read_index():
    return FileResponse("static/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)