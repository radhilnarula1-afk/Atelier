import sqlite3
import os
from datetime import datetime

DB_PATH = "wardrobe.db"

def format_section(title):
    print("\n" + "=" * 60)
    print(f" {title.upper()} ".center(60, "="))
    print("=" * 60)

def check_activity():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file '{DB_PATH}' not found in the current directory.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # --- 1. OVERALL STATS ---
    format_section("Atelier Wardrobe AI - System Activity Report")
    
    total_users = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    total_items = cursor.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]
    total_calendar = cursor.execute("SELECT COUNT(*) FROM calendar").fetchone()[0]
    
    # Check uploads folder size
    uploads_count = 0
    uploads_size_mb = 0.0
    if os.path.exists("uploads"):
        for f in os.listdir("uploads"):
            fp = os.path.join("uploads", f)
            if os.path.isfile(fp):
                uploads_count += 1
                uploads_size_mb += os.path.getsize(fp) / (1024 * 1024)

    print(f"  * Registered Users:       {total_users}")
    print(f"  * Total Wardrobe Items:   {total_items}")
    print(f"  * Scheduled Outfits:      {total_calendar}")
    print(f"  * Scanned Images Uploaded: {uploads_count} ({uploads_size_mb:.2f} MB total)")

    # --- 2. DETAILED USER-BY-USER BREAKDOWN ---
    format_section("User Profiles & Activity")
    
    users = cursor.execute("SELECT id, username FROM users ORDER BY id ASC").fetchall()
    
    for u in users:
        user_id = u["id"]
        username = u["username"]
        
        # Get inventory items count & breakdown
        inv_rows = cursor.execute(
            "SELECT type, color, fit, added_at FROM inventory WHERE user_id = ? ORDER BY added_at DESC", 
            (user_id,)
        ).fetchall()
        
        # Get calendar items
        cal_rows = cursor.execute(
            "SELECT date, location, weather, temperature, mood, notes FROM calendar WHERE user_id = ? ORDER BY date DESC", 
            (user_id,)
        ).fetchall()
        
        print(f"\n[USER] {username.upper()} (User ID: {user_id})")
        print(f"  +-- Wardrobe Inventory: {len(inv_rows)} items")
        if inv_rows:
            # Short summary of items
            type_counts = {}
            for row in inv_rows:
                t = row["type"] or "unknown"
                type_counts[t] = type_counts.get(t, 0) + 1
            breakdown_str = ", ".join([f"{k} (x{v})" for k, v in type_counts.items()])
            print(f"      +-- Types: {breakdown_str}")
            
            # Most recent item
            recent = inv_rows[0]
            print(f"      +-- Latest upload: {recent['color']} {recent['type']} ({recent['fit']} fit) added at {recent['added_at'][:10]}")
        else:
            print("      +-- No items in inventory yet.")

        print(f"  +-- Calendar Schedule:  {len(cal_rows)} entries")
        if cal_rows:
            for entry in cal_rows[:3]:  # Show top 3 recent entries
                print(f"      +-- [{entry['date']}] at {entry['location'] or 'Unknown'}")
                print(f"      |   +-- Weather: {entry['weather'] or 'Unknown'} ({entry['temperature']}°C)")
                print(f"      |   +-- Mood: {entry['mood'] or 'N/A'}")
                if entry["notes"]:
                    print(f"      |   +-- Notes: {entry['notes']}")
            if len(cal_rows) > 3:
                print(f"      +-- ... and {len(cal_rows) - 3} more schedule logs")
        else:
            print("      +-- No outfit logs on the calendar yet.")
            
        print("-" * 50)

    conn.close()

if __name__ == "__main__":
    check_activity()
