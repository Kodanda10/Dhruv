import pandas as pd
import sys

try:
    df = pd.read_excel('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx')
    print("Column Headers:")
    for col in df.columns:
        print(col)
    print("\nFirst 5 rows:")
    print(df.head().to_string())
except Exception as e:
    print(f"Error reading Excel file: {e}")
    print("Please ensure pandas is installed (`pip install pandas openpyxl`)")
    sys.exit(1)
