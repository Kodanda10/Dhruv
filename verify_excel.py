
import pandas as pd

# Load the Excel file
excel_file = pd.ExcelFile('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx')

# Print the sheet names
print("Sheet names:", excel_file.sheet_names)

# Print the first 5 rows of each sheet
for sheet_name in excel_file.sheet_names:
    print(f"\nSheet: {sheet_name}")
    df = pd.read_excel(excel_file, sheet_name=sheet_name)
    print(df.head())

