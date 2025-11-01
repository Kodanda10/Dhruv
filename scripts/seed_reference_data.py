import psycopg2
import os
from datetime import datetime

def seed_additional_data():
    """Seed additional reference data beyond migration defaults"""
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        database=os.getenv('DB_NAME', 'project_dhruv'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD')
    )
    cursor = conn.cursor()
    
    # Additional Central Schemes
    additional_central = [
        ('PMFBY', 'प्रधानमंत्री फसल बीमा योजना', 'PM Fasal Bima Yojana', 'Agriculture'),
        ('PMGKY', 'प्रधानमंत्री गरीब कल्याण योजना', 'PM Garib Kalyan Yojana', 'Welfare'),
        ('PMGSY', 'प्रधानमंत्री ग्राम सड़क योजना', 'PM Gram Sadak Yojana', 'Rural Development'),
    ]
    
    for code, name_hi, name_en, ministry in additional_central:
        cursor.execute("""
            INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry)
            VALUES (%s, %s, %s, 'central', %s)
            ON CONFLICT (scheme_code) DO NOTHING
        """, (code, name_hi, name_en, ministry))
    
    # Additional CG Schemes
    additional_state = [
        ('SHAHEED_MAHILA_SAMMAN', 'शहीद महिला सम्मान योजना', 'Shaheed Mahila Samman', 'Women Welfare'),
        ('NARVA_GARWA', 'नरवा गरवा घुरवा बाड़ी', 'Narva Garwa Ghurwa Baadi', 'Rural Development'),
    ]
    
    for code, name_hi, name_en, ministry in additional_state:
        cursor.execute("""
            INSERT INTO ref_schemes (scheme_code, name_hi, name_en, category, ministry)
            VALUES (%s, %s, %s, 'state', %s)
            ON CONFLICT (scheme_code) DO NOTHING
        """, (code, name_hi, name_en, ministry))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✓ Reference data seeded successfully")

if __name__ == "__main__":
    seed_additional_data()
