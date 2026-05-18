# Wardrobe AI

Upload a photo of a clothing item → get intelligent recommendations for similar items from H&M India.

---

## How it works

```
User uploads photo
  → Fine-tuned MobileNetV2 predicts: type, color, fit, print, theme
  → Real scraped products are loaded from the local database
  → Gemini ranks the best product matches
  → Top 4 recommendations returned
```

---

## Project structure

```
wardrobe_ai/
  main.py              ← FastAPI backend server
  train.py             ← Model fine-tuning script (run on Google Colab)
  scraper.py           ← Scrapes H&M India + auto-labels with Gemini
  requirements.txt
  .env                 ← Your API key goes here (create this yourself)
  models/
    clothing_classifier.pt    ← generated after running train.py
  dataset/
    products.db               ← SQLite DB of scraped products (for recommendations)
    train/
      tshirt/
        0000.jpg
        0000.json
      polo/ jeans/ hoodie/ ...
    val/
      tshirt/ polo/ ...
```

---

## Step-by-step setup

### Step 1 — Install dependencies

```bash
pip install -r requirements.txt
playwright install chromium
```

### Step 2 — Create your API key file

Go to https://aistudio.google.com, sign in with Google, and create a free API key.
Then create a file called `.env` in the project folder:

```
GEMINI_API_KEY=your_key_here
```

The free tier gives you 1500 requests/day. Do NOT put the key directly in Python files.

### Step 3 — Scrape training data

```bash
python scraper.py
```

This scrapes H&M India for images and uses Gemini to auto-label each product.
Takes 15–30 minutes depending on your connection.

Outputs:
- `dataset/train/` and `dataset/val/` — images + JSON label files for training
- `dataset/products.db` — SQLite database of product metadata used for recommendations

### Step 4 — Train the model (use Google Colab for free GPU)

Upload the project to Google Colab:
- Runtime → Change runtime type → T4 GPU (free)

```bash
python train.py
```

Takes 1–2 hours on Colab free GPU.
Saves the model to: `models/clothing_classifier.pt`

You can also run this locally if you have a GPU. On CPU it will be much slower.

### Step 5 — Run the backend server

```bash
python main.py
```

Server starts at: http://localhost:8000  
API docs at: http://localhost:8000/docs

### Step 6 — Test the API

```bash
# Test label prediction only
curl -X POST "http://localhost:8000/predict" \
  -F "file=@your_photo.jpg"

# Test full recommendation pipeline
curl -X POST "http://localhost:8000/recommend" \
  -F "file=@your_photo.jpg" \
  -F 'inventory=[]'

# View your wardrobe inventory
curl http://localhost:8000/inventory
```

---

## API endpoints

| Endpoint | Method | What it does |
|---|---|---|
| `/predict` | POST | Photo → clothing labels (fine-tuned model) |
| `/recommend` | POST | Photo + inventory → top 4 recommendations (Gemini) |
| `/inventory/add` | POST | Save a clothing item to your wardrobe (SQLite) |
| `/inventory` | GET | Get all saved wardrobe items |
| `/inventory/{id}` | DELETE | Remove an item from your wardrobe |
| `/docs` | GET | Interactive API documentation (Swagger UI) |

---

## Key concepts (for explaining to your professor)

**Transfer Learning**  
MobileNetV2 was pretrained on 1.2 million ImageNet photos. It already understands shapes, textures, and colors from the real world. We only replace and retrain the final classification layer for our clothing categories. This is why we need far fewer photos (500–2000 per class) compared to training from scratch (millions).

**Fine-tuning**  
We first train only the new classification head while the backbone is frozen. After a few warmup epochs, we unfreeze all layers and continue training at a much lower learning rate. This avoids destroying the learned ImageNet features.

**Multi-label classification**  
The model predicts multiple attributes simultaneously — type, color, fit, print category, and theme — from a single forward pass. The output is sliced into per-category predictions. This is more efficient than running five separate models.

**Two-model pipeline**  
The vision model (fine-tuned MobileNet) handles seeing and classifying. Gemini handles natural language reasoning and recommendation ranking. Each model does what it is best at.

**Real product retrieval (not hallucination)**  
The scraper saves real product metadata to a SQLite database. When a user uploads a photo, the backend loads real products matching the detected clothing type and sends them to Gemini. Gemini ranks them rather than inventing fake ones. This is a lightweight version of the Retrieval-Augmented Generation (RAG) pattern.

**Safe API key handling**  
API keys are stored in a `.env` file and loaded with `python-dotenv`. They are never hardcoded in Python files or committed to version control.

---

## Common issues

**`GEMINI_API_KEY not set`**  
Create a `.env` file in the project folder containing `GEMINI_API_KEY=your_key_here`

**`No fine-tuned model found — using random weights`**  
Run `python train.py` first to generate `models/clothing_classifier.pt`

**`Dataset split not found`**  
Run `python scraper.py` first to build the dataset folder

**Scraper finds 0 products**  
H&M may have updated their page layout. Check `dataset/failed.json` for error details. The scraper tries multiple CSS selectors as fallbacks, but H&M sometimes changes their HTML significantly.

**Slow training on CPU**  
Use Google Colab with a free T4 GPU. Training on CPU takes many hours.
