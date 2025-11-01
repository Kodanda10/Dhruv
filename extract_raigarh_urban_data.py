
import pandas as pd

# Load the urban data
urban_df = pd.read_excel('/Users/abhijita/Projects/Project_Dhruv/data/CG_Urgban_Geo_4.xlsx')

# Filter for Raigarh district
raigarh_urban_df = urban_df[urban_df['district'] == 'रायगढ़'].copy()

# Select and rename columns
raigarh_urban_df = raigarh_urban_df[['district', 'ulb', 'ward']]
raigarh_urban_df.rename(columns={'district': 'District', 'ulb': 'ULB', 'ward': 'Ward'}, inplace=True)

# Append to the existing Excel file
with pd.ExcelWriter('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx', mode='a', engine='openpyxl') as writer:
    raigarh_urban_df.to_excel(writer, sheet_name='Urban', index=False)

print("Urban data for Raigarh extracted and appended to 'Raigarh_Constituency_Data.xlsx'")
