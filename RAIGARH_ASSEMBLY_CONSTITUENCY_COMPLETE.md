# रायगढ़ Assembly Constituency - Complete Hierarchy

## Overview
This document provides the complete administrative hierarchy for **रायगढ़ (Raigarh) Assembly Constituency** only, extracted from the Chhattisgarh geography dataset.

## Administrative Structure

### Assembly Constituency Details
- **Name**: रायगढ़ (Raigarh)
- **Type**: Assembly Constituency
- **Part of Parliamentary Constituency**: रायगढ़ (एसटी) - Raigarh (Scheduled Tribe)

### Summary Statistics
| Administrative Level | Count |
|---------------------|-------|
| Blocks | 1 |
| Urban Local Bodies (ULBs) | 1 |
| Gram Panchayats | 84 |
| Villages | 132 |

## Block Details

### रायगढ़ Block
- **Block Name**: रायगढ़ (Raigarh)
- **ULB Status**: ✓ Has ULB
- **ULB Name**: रायगढ़

## Complete Hierarchy Structure

### Urban Local Body (ULB)
- **ULB Name**: रायगढ़
- **Ward Information**: Not available in current dataset

### Gram Panchayats and Villages (84 GPs, 132 Villages)

#### Large Gram Panchayats (3+ Villages)
1. **Adbahal** (4 villages): Adbahal, Balbhadrapur, Sarbahal, Sikosimal
2. **Barpali** (3 villages): Arsipali, Barpali, Mauhapali  
3. **Bhatpur** (3 villages): Bhatpur, Dulopur, Salhepali
4. **Jharguda** (3 villages): Deobahal, Jharguda, Natwarpur
5. **Nawagaon** (4 villages): Chakradharpur, Chhirwani, Dhumabahal, Nawagaon

#### Medium Gram Panchayats (2 Villages)
- **2-Village GPs (34 total)**:
  - Aurabhata, Bade Attarmuda, Baghanpur, Bangursia, Bardaputi, Behrapali
  - Belria, Bhelwatikara, Chuhipali, Delari, Dongitrai, Gejamuda
  - Gerwani, Gopalpur, Jorapali, Kerajhar, Khairpur, Kotarlia
  - Kotmar, Kulba, Kushwabahari, Lakha, Lamidaraha, Lebdrha
  - Nandali, Nansia, Nawapara, Panjhar, Parsada, Sakarboga
  - Sambalpuri, Sapnai, Sardamal, Sarwani, Siyarpali, Viswanathpali

#### Small Gram Panchayats (1 Village)
- **1-Village GPs (48 total)**:
  - Balamgoda, Banora, Bansia, Barlia, Bayang, Bhagora, Chraipani
  - Deori, Dhanagar, Dumerpali, Jamgaon, Jampali, Jurda, Kacchar
  - Kalmi, Kantahardi, Kashichunwa, Kolaibahal, Kondtrai, Kosamnara
  - Kosampali, Kotara, Koylanga, Kukurda, Kuramapali, Kusmura
  - Loing, Mahapalli, Manwapali, Naorangapur, Pandaripani (E)
  - Pandrepani (W), Patelpali, Patrapali (E), Regada, Sahaspuri
  - Sangitarai, Tarapur, Tarkela, Tarpali, Tilga, Uchchabhithi
  - Usroat

## Data Files Generated

### 1. CSV File: `data/raigarh_assembly_constituency_detailed.csv`
**Structure:**
```csv
Assembly Constituency,Block,Administrative Type,GP/ULB Name,Village/Ward,Entity Type
रायगढ़,रायगढ़,ULB,रायगढ़,Ward data not available in current dataset,ULB
रायगढ़,रायगढ़,Gram Panchayat,Adbahal,Adbahal,Village
रायगढ़,रायगढ़,Gram Panchayat,Adbahal,Balbhadrapur,Village
...
```

### 2. JSON File: `data/raigarh_assembly_constituency_detailed.json`
**Structure:** Hierarchical JSON with blocks, gram panchayats, and villages organized by administrative levels.

## Key Observations

1. **रायगढ़ Assembly Constituency** consists of only the **रायगढ़ Block**
2. The block has both **rural governance** (84 Gram Panchayats) and **urban governance** (1 ULB)
3. **Village Distribution**:
   - 48 GPs have 1 village each (57% of GPs)
   - 34 GPs have 2 villages each (40% of GPs)  
   - 5 GPs have 3-4 villages each (6% of GPs)
4. **Ward data** for the ULB is not available in the current dataset

## Usage Notes

- This data represents the administrative structure as per the source geography dataset
- Village names are presented as they appear in the original data
- Some villages may have alternative spellings or transliterations
- For electoral purposes, ward boundaries within the ULB would need additional data sources

## Data Source
- **Primary Dataset**: `/data/datasets/by_district/र-यगढ़.ndjson`
- **Administrative Mapping**: `/data/constituencies.json`
- **Generated**: October 2025

---
*Complete hierarchy data available in CSV and JSON formats for further analysis or system integration.*