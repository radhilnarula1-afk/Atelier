import subprocess
import glob
import os

try:
    import onnxruntime
    print("ONNX Runtime imported successfully!")
except ImportError as e:
    print("Failed to import onnxruntime:", e)
    try:
        capi_dirs = glob.glob('/usr/local/lib/python*/site-packages/onnxruntime/capi/')
        if capi_dirs:
            capi_dir = capi_dirs[0]
            so_files = glob.glob(os.path.join(capi_dir, '*pybind*.so'))
            if so_files:
                print(f"=== LDD DIAGNOSTICS FOR {so_files[0]} ===")
                # run ldd and let stdout stream directly to terminal
                subprocess.run(['ldd', so_files[0]])
            else:
                print("No SO files found in", capi_dir)
        else:
            print("No capi directory found")
    except Exception as ex:
        print("Error during ldd diagnostics:", ex)
    raise e
