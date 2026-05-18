import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
groq_key = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY", "")
client = Groq(api_key=groq_key)

try:
    print("Listing Groq models...")
    models = client.models.list()
    for m in models.data:
        print(f"- {m.id}")
except Exception as e:
    print(f"Error listing models: {e}")
