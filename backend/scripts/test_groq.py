import os
from dotenv import load_dotenv
from groq import Groq

print("Loading .env...")
load_dotenv()

# Check keys
groq_key = os.getenv("GROQ_API_KEY") or os.getenv("GEMINI_API_KEY", "")
print(f"API Key found (truncated): {groq_key[:10]}...{groq_key[-10:] if len(groq_key) > 10 else ''}")

try:
    print("Initializing Groq client...")
    client = Groq(api_key=groq_key)
    
    print("Testing chat completion with 'llama-3.3-70b-versatile'...")
    completion = client.chat.completions.create(
        messages=[{"role": "user", "content": "Hello! Say hi."}],
        model="llama-3.3-70b-versatile",
    )
    print("\n[SUCCESS] Groq API Response:")
    print(completion.choices[0].message.content)
    
except Exception as e:
    print("\n[ERROR] Groq API call failed:")
    import traceback
    traceback.print_exc()
