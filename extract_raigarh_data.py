
import pandas as pd

# Load the dataset
df = pd.read_csv('/Users/abhijita/Projects/Project_Dhruv/data/raigarh_assembly_constituency_detailed.csv')

# Extract Rural Data
rural_df = df[df['Administrative Type'] == 'Gram Panchayat'].copy()
rural_df = rural_df[['Assembly Constituency', 'Block', 'GP/ULB Name', 'Village/Ward']]
rural_df.rename(columns={'GP/ULB Name': 'Gram Panchayat', 'Village/Ward': 'Village'}, inplace=True)

# Extract Urban Data
urban_df = df[df['Administrative Type'] == 'ULB'].copy()
urban_df = urban_df[['Assembly Constituency', 'Block', 'GP/ULB Name', 'Village/Ward']]
urban_df.rename(columns={'GP/ULB Name': 'ULB', 'Village/Ward': 'Ward'}, inplace=True)

# Create a new Excel file with two sheets
with pd.ExcelWriter('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx') as writer:
    rural_df.to_excel(writer, sheet_name='Rural', index=False)
    urban_df.to_excel(writer, sheet_name='Urban', index=False)

print("Excel file 'Raigarh_Constituency_Data.xlsx' created successfully with Rural and Urban data.")
