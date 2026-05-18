import os
import base64
import json
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
groq_key = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY", "")
client = Groq(api_key=groq_key)

image_path = r"dataset/train/tshirt/0000.jpg"

def encode_image(img_path):
    with open(img_path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')

try:
    print(f"Encoding image {image_path}...")
    base64_image = encode_image(image_path)
    
    print("Sending request to meta-llama/llama-4-scout-17b-16e-instruct...")
    prompt = "Tell me what color this garment is. Answer with one word only."
    
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
    
    print("\n[SUCCESS] Response from model:")
    print(completion.choices[0].message.content)
    
except Exception as e:
    print(f"\n[ERROR] Vision call failed: {e}")
