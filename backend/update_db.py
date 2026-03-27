import sqlite3
import os

def update_db():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, "ris_scan_pro.db")
    
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Checking if 'raw_text' column already exists in 'scan_results'...")
        cursor.execute("PRAGMA table_info(scan_results)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'raw_text' not in columns:
            print("Adding 'raw_text' column to 'scan_results' table...")
            cursor.execute("ALTER TABLE scan_results ADD COLUMN raw_text TEXT")
            conn.commit()
            print("Successfully added 'raw_text' column.")
        
        if 'reliability_score' not in columns:
            print("Adding 'reliability_score' column...")
            cursor.execute("ALTER TABLE scan_results ADD COLUMN reliability_score INTEGER DEFAULT 100")
            conn.commit()
            
        if 'career_data' not in columns:
            print("Adding 'career_data' column...")
            cursor.execute("ALTER TABLE scan_results ADD COLUMN career_data TEXT")
            conn.commit()
        else:
            print("Columns already up to date.")
            
    except Exception as e:
        print(f"Error updating database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    update_db()
