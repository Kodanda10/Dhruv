
import pandas as pd

# Load the urban data
urban_df = pd.read_excel('/Users/abhijita/Projects/Project_Dhruv/data/CG_Urgban_Geo_4.xlsx')

# Clean the district names
urban_df['district'] = urban_df['district'].str.strip()

# Filter for Raigarh district
raigarh_urban_df = urban_df[urban_df['district'] == 'रायगढ़'].copy()

# Select and rename columns
raigarh_urban_df = raigarh_urban_df[['district', 'ulb', 'ward']]
raigarh_urban_df.rename(columns={'district': 'District', 'ulb': 'ULB', 'ward': 'Ward'}, inplace=True)

# Load existing rural data
rural_df = pd.read_excel('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx', sheet_name='Rural')

# Create a new Excel file with both sheets
with pd.ExcelWriter('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx') as writer:
    rural_df.to_excel(writer, sheet_name='Rural', index=False)
    raigarh_urban_df.to_excel(writer, sheet_name='Urban', index=False)

print("Urban data for Raigarh extracted and appended to 'Raigarh_Constituency_Data.xlsx'")
