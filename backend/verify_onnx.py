import subprocess
import glob
import os
import sys

try:
    import onnxruntime
    print("ONNX Runtime imported successfully!")
    sys.exit(0)
except ImportError as e:
    sys.stderr.write(f"Failed to import onnxruntime: {e}\n")
    try:
        capi_dirs = glob.glob('/usr/local/lib/python*/site-packages/onnxruntime/capi/')
        if capi_dirs:
            capi_dir = capi_dirs[0]
            so_files = glob.glob(os.path.join(capi_dir, '*pybind*.so'))
            if so_files:
                sys.stderr.write(f"=== LDD DIAGNOSTICS FOR {so_files[0]} ===\n")
                res = subprocess.run(['ldd', so_files[0]], capture_output=True, text=True)
                sys.stderr.write(res.stdout)
                sys.stderr.write(res.stderr)
            else:
                sys.stderr.write(f"No SO files found in {capi_dir}\n")
        else:
            sys.stderr.write("No capi directory found\n")
    except Exception as ex:
        sys.stderr.write(f"Error during ldd diagnostics: {ex}\n")
    sys.exit(1)
