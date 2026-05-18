import urllib.request
import os

url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1MjEwMjVjMmJmOWEwOTI1ZDNiNjQzMzE0ZDIwEgsSBxCsvbyvqgkYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjUzNjI2MDQ3NjkzNzcyMzQ0OA&filename=&opi=89354086"
os.makedirs("scratch", exist_ok=True)

try:
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        with open("scratch/stitch_raw.html", "w", encoding="utf-8") as f:
            f.write(html)
    print("SUCCESS: Fetched and wrote scratch/stitch_raw.html successfully")
except Exception as e:
    print("ERROR:", e)
