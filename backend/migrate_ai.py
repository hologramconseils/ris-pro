import sqlite3
import os

def migrate():
    db_files = ["ris_scan_pro.db", "sql_app.db"]
    
    for db_file in db_files:
        if not os.path.exists(db_file):
            continue
            
        print(f"Migrating {db_file}...")
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute("ALTER TABLE scan_results ADD COLUMN ai_analysis TEXT")
            print(f"Added ai_analysis column to {db_file}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column ai_analysis already exists in {db_file}")
            else:
                print(f"Error migrating {db_file}: {e}")
        
        conn.commit()
        conn.close()

if __name__ == "__main__":
    migrate()
