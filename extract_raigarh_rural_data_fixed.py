
import json
import pandas as pd

# Load the file content
with open('/Users/abhijita/Projects/Project_Dhruv/data/chhattisgarh_complete_geography.json', 'r') as f:
    content = f.read()

# Clean the content
cleaned_content = content.strip().replace('```json', '').replace('```', '')

# Parse the JSON
try:
    data = json.loads(cleaned_content)
except json.JSONDecodeError as e:
    print(f"Error decoding JSON: {e}")
    # Print the problematic content for debugging
    print("Problematic content:")
    print(cleaned_content)
    exit()

# Find the Raigarh district
raigarh_district = None
for district in data['districts']:
    if district['name'] == 'रायगढ़':
        raigarh_district = district
        break

if raigarh_district:
    # Find the Raigarh Assembly Constituency
    raigarh_ac = None
    for ac in raigarh_district['acs']:
        if ac['name'] == 'रायगढ़':
            raigarh_ac = ac
            break

    if raigarh_ac:
        # Extract Rural Data
        rural_data = []
        for block in raigarh_ac['blocks']:
            for gp in block['gps']:
                for village in gp['villages']:
                    rural_data.append({
                        'Assembly Constituency': raigarh_ac['name'],
                        'Block': block['name'],
                        'Gram Panchayat': gp['name'],
                        'Village': village['name']
                    })

        # Create a DataFrame and save to Excel
        rural_df = pd.DataFrame(rural_data)
        with pd.ExcelWriter('/Users/abhijita/Projects/Project_Dhruv/Raigarh_Constituency_Data.xlsx') as writer:
            rural_df.to_excel(writer, sheet_name='Rural', index=False)

        print("Rural data extracted and saved to 'Raigarh_Constituency_Data.xlsx'")
    else:
        print("Raigarh Assembly Constituency not found.")
else:
    print("Raigarh district not found.")
