FROM python:3.10-slim

WORKDIR /app

# Install system build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Print dynamic linker dependencies to debug missing libraries
RUN python -c "import os, subprocess, glob; capi_dir = os.path.dirname(glob.glob('/usr/local/lib/python*/site-packages/onnxruntime/capi/__init__.py')[0]); so_files = glob.glob(os.path.join(capi_dir, '*pybind*.so')); subprocess.run(['ldd', so_files[0]]) if so_files else print('No SO files found')"

# Verify system dependencies are satisfied for ONNX Runtime
RUN python -c "import onnxruntime"

# Copy application source
COPY main.py .

# Copy model weights and read-only product database
COPY models/ ./models/
COPY dataset/products.db ./dataset/products.db

# Runtime directories (Cloudinary is primary; local is fallback only)
RUN mkdir -p uploads static

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
