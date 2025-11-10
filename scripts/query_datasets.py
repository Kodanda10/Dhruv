<file_path>
Project_Dhruv/scripts/query_datasets.py
</file_path>

<edit_description>
Create a script to query and show inserted data
</edit_description>

import psycopg2
import json

def query_datasets():
    conn = psycopg2.connect(
        host="localhost",
        database="dhruv_db",
        user="dhruv_user",
        password="dhruv_pass"
    )
    cursor = conn.cursor()

    print("=== Geography Dataset ===")
    cursor.execute("SELECT * FROM dims.dim_geography LIMIT 10")
    rows = cursor.fetchall()
    for row in rows:
        print(row)

    print("\n=== Festival Dataset ===")
    cursor.execute("SELECT f.name, f.type, fd.year, fd.date FROM dims.dim_festival f LEFT JOIN dims.dim_festival_dates fd ON f.id = fd.festival_id LIMIT 10")
    rows = cursor.fetchall()
    for row in rows:
        print(row)

    print("\n=== POI Dataset ===")
    cursor.execute("SELECT name, type, lat, lon, address FROM dims.dim_poi LIMIT 10")
    rows = cursor.fetchall()
    for row in rows:
        print(row)

    cursor.close()
    conn.close()

if __name__ == "__main__":
    query_datasets()
