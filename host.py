import http.server
import socketserver
import subprocess
import threading
import time
import sys

PORT = 8000

def start_server():
    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"[*] Local server running at http://localhost:{PORT}")
        httpd.serve_forever()

def start_tunnel():
    print("[*] Requesting public URL via localhost.run...")
    # StrictHostKeyChecking=no bypasses the first-time yes/no prompt
    cmd = [
        "ssh", "-o", "StrictHostKeyChecking=no",
        "-R", f"80:localhost:{PORT}",
        "nokey@localhost.run"
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in iter(process.stdout.readline, ''):
            if line:
                print(line.strip())
    except Exception as e:
        print(f"[!] Error starting tunnel: {e}")

if __name__ == "__main__":
    # Start the HTTP server in a daemon thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    
    # Wait a moment to ensure server is up
    time.sleep(1)
    
    # Start the SSH tunnel (blocks)
    try:
        start_tunnel()
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
        sys.exit(0)
