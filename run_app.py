import subprocess
import os
import sys
import time

def start_all_servers():
    print("==================================================")
    print("          ATELIER - WARDROBE INTELLIGENCE         ")
    print("==================================================")
    print("Starting all services...")

    python_exe = sys.executable
    if os.path.exists(".venv/Scripts/python.exe"):
        python_exe = os.path.abspath(".venv/Scripts/python.exe")
    
    # ─── START BACKEND ──────────────────────────────────────────────────────────
    print("\n[1/2] Starting FastAPI Backend on http://localhost:8000...")
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    
    # Run main.py inside the backend directory to preserve relative pathing
    backend_dir = os.path.abspath("backend")
    backend_proc = subprocess.Popen(
        [python_exe, "main.py"],
        cwd=backend_dir,
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    )

    # ─── START FRONTEND ─────────────────────────────────────────────────────────
    frontend_dir = os.path.abspath("frontend")
    print(f"[2/2] Starting React Vite Frontend in {os.path.basename(frontend_dir)} on http://localhost:8080...")
    
    # Run npm run dev inside the frontend directory
    # On Windows, shell=True is crucial to execute .cmd scripts like npm
    frontend_proc = subprocess.Popen(
        "npm run dev",
        cwd=frontend_dir,
        shell=True,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0
    )

    # Allow time for initial startup logs
    time.sleep(2.5)

    print("\n==================================================")
    print("  ATELIER APPLICATION IS ACTIVE AND RUNNING!")
    print("==================================================")
    print("  Access the Frontend UI:  http://localhost:8080")
    print("  Access the Backend API:  http://localhost:8000")
    print("  Interactive API Docs:   http://localhost:8000/docs")
    print("==================================================")
    print("Press Ctrl+C to stop all servers cleanly.")
    print("==================================================")

    try:
        while True:
            # Check if any process died unexpectedly
            if backend_proc.poll() is not None:
                print("\n[!] Backend server stopped unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("\n[!] Frontend server stopped unexpectedly.")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping all services...")
    finally:
        # Clean termination of processes on Windows
        if sys.platform == "win32":
            # Using taskkill to clean entire process trees (especially node/npm subprocesses)
            subprocess.run(f"taskkill /F /T /PID {backend_proc.pid}", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
            subprocess.run(f"taskkill /F /T /PID {frontend_proc.pid}", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
        else:
            backend_proc.terminate()
            frontend_proc.terminate()
            
        print("All servers stopped successfully.")

def start():
    """Run both frontend and backend servers cleanly."""
    start_all_servers()

if __name__ == "__main__":
    # Check if 'start' is passed as a command-line argument
    if len(sys.argv) > 1 and sys.argv[1].lower() == "start":
        start_all_servers()
    else:
        try:
            print("==================================================")
            print("          ATELIER - WARDROBE INTELLIGENCE         ")
            print("==================================================")
            user_input = input("Type 'start' and press Enter to run everything: ").strip().lower()
            if user_input == "start":
                start_all_servers()
            else:
                print("Launcher exited. You must type 'start' to run the application.")
        except (KeyboardInterrupt, EOFError):
            print("\nLauncher exited.")
