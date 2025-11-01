#!/usr/bin/env python3
"""
Raigarh Urban Ward Data Extraction Script
==========================================

This script attempts to extract urban ward data for Raigarh Assembly Constituency
from available sources and creates a comprehensive summary.

Focus Areas:
1. Identify ULBs within Raigarh Assembly Constituency
2. Extract ward-level data where available
3. Cross-reference with official sources
4. Generate structured output for further verification

Generated: October 2025
"""

import json
import csv
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def extract_urban_indicators():
    """Extract urban indicators from the main Raigarh dataset"""
    logger.info("🔍 Extracting urban indicators from Raigarh dataset...")
    
    urban_data = []
    potential_ulbs = set()
    
    # Read the main Raigarh dataset
    with open('data/datasets/by_district/र-यगढ़.ndjson', 'r', encoding='utf-8') as f:
        for line in f:
            record = json.loads(line.strip())
            
            # Extract fields
            block = record.get('block', '')
            gp = record.get('gram_panchayat', '')
            village = record.get('village', '')
            
            # Urban indicators
            urban_keywords = [
                'नगर', 'municipal', 'corporation', 'council', 
                'रायगढ़', 'ward', 'वार्ड', 'शहर', 'नगरपालिका'
            ]
            
            # Check if this might be an urban area
            is_urban_candidate = False
            for keyword in urban_keywords:
                if (keyword.lower() in gp.lower() or 
                    keyword.lower() in village.lower() or
                    keyword in gp or keyword in village):
                    is_urban_candidate = True
                    break
            
            # Special check for Raigarh city
            if 'रायगढ़' in gp or 'रायगढ़' in village:
                is_urban_candidate = True
                potential_ulbs.add(gp)
            
            # Check for numbered areas (often wards)
            if any(char.isdigit() for char in village):
                if ('ward' in village.lower() or 'वार्ड' in village or
                    'क्रमांक' in village or 'नं' in village):
                    is_urban_candidate = True
                    potential_ulbs.add(gp)
            
            if is_urban_candidate:
                urban_record = {
                    'district': record.get('district', ''),
                    'block': block,
                    'gram_panchayat': gp,
                    'village': village,
                    'potential_ulb': gp if is_urban_candidate else '',
                    'urban_indicators': [],
                    'source': record.get('source', {})
                }
                
                # Note what made it urban
                for keyword in urban_keywords:
                    if keyword.lower() in gp.lower() or keyword.lower() in village.lower():
                        urban_record['urban_indicators'].append(keyword)
                
                urban_data.append(urban_record)
    
    logger.info(f"Found {len(urban_data)} records with urban indicators")
    logger.info(f"Potential ULBs identified: {len(potential_ulbs)}")
    
    return urban_data, list(potential_ulbs)

def analyze_raigarh_assembly_constituency():
    """Analyze the Raigarh Assembly Constituency for urban areas"""
    logger.info("🏛️ Analyzing Raigarh Assembly Constituency data...")
    
    # From our previous analysis, we know the रायगढ़ Assembly Constituency 
    # consists of only रायगढ़ Block with 84 GPs and 132 villages
    
    assembly_analysis = {
        'assembly_constituency': 'रायगढ़',
        'blocks': ['रायगढ़'],
        'total_gram_panchayats': 84,
        'total_villages': 132,
        'urban_areas_found': False,
        'ulb_data': {},
        'ward_data': {},
        'data_gaps': []
    }
    
    # Check if Raigarh city (the district headquarters) falls within 
    # the assembly constituency
    
    # Based on our CSV data analysis
    csv_file = 'data/raigarh_assembly_constituency_detailed.csv'
    if Path(csv_file).exists():
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row['Administrative Type'] == 'ULB':
                    assembly_analysis['urban_areas_found'] = True
                    ulb_name = row['GP/ULB Name']
                    assembly_analysis['ulb_data'][ulb_name] = {
                        'block': row['Block'],
                        'ward_data_available': 'Ward data not available in current dataset' not in row['Village/Ward'],
                        'notes': row['Village/Ward']
                    }
    
    # Identify data gaps
    assembly_analysis['data_gaps'] = [
        "Ward-level data not available in current dataset",
        "ULB boundaries not defined",
        "Population data not included",
        "Electoral ward mappings missing"
    ]
    
    return assembly_analysis

def create_ward_data_template():
    """Create a template for ward data collection"""
    logger.info("📋 Creating ward data collection template...")
    
    # Based on typical Indian ULB structure
    template = {
        'raigarh_ulb': {
            'official_name': 'रायगढ़ नगर पालिका/नगर निगम',
            'type': 'Municipal Corporation/Municipality',
            'block': 'रायगढ़',
            'assembly_constituency': 'रायगढ़',
            'estimated_wards': 'TBD',  # To be determined from official sources
            'ward_template': {
                'ward_number': '',
                'ward_name_hindi': '',
                'ward_name_english': '',
                'area_description': '',
                'population': 'TBD',
                'key_localities': [],
                'boundaries': 'TBD',
                'councillor': 'TBD'
            },
            'data_sources_needed': [
                'Raigarh Municipal Corporation website',
                'State Election Commission ward lists',
                'Census 2011/2024 ward data',
                'Local government gazettes'
            ]
        }
    }
    
    return template

def generate_comprehensive_summary():
    """Generate comprehensive summary with recommendations"""
    logger.info("📊 Generating comprehensive summary...")
    
    # Extract urban indicators
    urban_data, potential_ulbs = extract_urban_indicators()
    
    # Analyze assembly constituency
    assembly_analysis = analyze_raigarh_assembly_constituency()
    
    # Create ward template
    ward_template = create_ward_data_template()
    
    # Compile comprehensive report
    comprehensive_report = {
        'summary': {
            'title': 'Raigarh Assembly Constituency - Urban Ward Data Analysis',
            'generated': '2025-10-10',
            'status': 'INCOMPLETE - Ward data not available in current dataset'
        },
        'assembly_constituency_analysis': assembly_analysis,
        'urban_indicators_found': {
            'total_records': len(urban_data),
            'potential_ulbs': potential_ulbs,
            'urban_candidates': urban_data[:10] if urban_data else []  # First 10 samples
        },
        'ward_collection_template': ward_template,
        'official_sources_to_check': [
            'https://raigarh.cgstate.gov.in - District administration',
            'https://cgstate.gov.in/en/departments/urban-administration - Urban Admin Dept',
            'Municipal Corporation of Raigarh official website',
            'Chhattisgarh State Election Commission ward lists',
            'Census 2011 ward data',
            'Electoral roll with ward boundaries'
        ],
        'next_steps': [
            'Contact Raigarh Municipal Corporation for official ward list',
            'Obtain ward boundaries from local administration',
            'Cross-reference with voter lists for ward verification',
            'Implement automated data collection from official portals'
        ],
        'recommendations': {
            'immediate': 'Use existing rural data (84 GPs, 132 villages) for rural areas',
            'short_term': 'Collect ward data through official channels',
            'long_term': 'Implement continuous monitoring of administrative changes'
        }
    }
    
    return comprehensive_report

def save_comprehensive_report(report):
    """Save the comprehensive report"""
    
    # Save JSON report
    json_file = 'data/raigarh_urban_ward_analysis.json'
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    # Save CSV template for data collection
    csv_file = 'data/raigarh_ward_collection_template.csv'
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Ward_Number', 'Ward_Name_Hindi', 'Ward_Name_English',
            'ULB_Name', 'Block', 'Assembly_Constituency',
            'Area_Description', 'Key_Localities', 'Boundaries',
            'Data_Source', 'Verification_Status', 'Notes'
        ])
        
        # Add sample rows
        writer.writerow([
            '1', 'वार्ड संख्या 1', 'Ward No. 1',
            'रायगढ़', 'रायगढ़', 'रायगढ़',
            'TBD', 'TBD', 'TBD',
            'Official Source Required', 'Pending', 'Template row'
        ])
    
    # Save human-readable summary
    md_file = 'data/raigarh_urban_ward_summary.md'
    with open(md_file, 'w', encoding='utf-8') as f:
        write_markdown_summary(f, report)
    
    logger.info(f"📁 Files created:")
    logger.info(f"  - {json_file}")
    logger.info(f"  - {csv_file}")
    logger.info(f"  - {md_file}")
    
    return json_file, csv_file, md_file

def write_markdown_summary(f, report):
    """Write markdown summary"""
    f.write("# Raigarh Assembly Constituency - Urban Ward Data Analysis\n\n")
    f.write(f"**Generated:** {report['summary']['generated']}  \n")
    f.write(f"**Status:** {report['summary']['status']}\n\n")
    
    f.write("## Executive Summary\n\n")
    analysis = report['assembly_constituency_analysis']
    f.write(f"- **Assembly Constituency:** {analysis['assembly_constituency']}\n")
    f.write(f"- **Blocks:** {', '.join(analysis['blocks'])}\n")
    f.write(f"- **Rural Coverage:** {analysis['total_gram_panchayats']} GPs, {analysis['total_villages']} villages\n")
    f.write(f"- **Urban Areas Found:** {'Yes' if analysis['urban_areas_found'] else 'No'}\n")
    f.write(f"- **Ward Data Available:** No\n\n")
    
    f.write("## Current Data Status\n\n")
    f.write("✅ **AVAILABLE:**\n")
    f.write("- Complete rural administrative hierarchy (Block > GP > Village)\n")
    f.write("- 84 Gram Panchayats with 132 villages\n")
    f.write("- Structured CSV and JSON format\n\n")
    
    f.write("❌ **MISSING:**\n")
    f.write("- Urban ward data for ULBs\n")
    f.write("- Ward boundaries and numbers\n")
    f.write("- Municipal corporation structure\n")
    f.write("- Population data by ward\n\n")
    
    f.write("## Data Gaps\n\n")
    for gap in analysis['data_gaps']:
        f.write(f"- {gap}\n")
    
    f.write("\n## Official Sources to Check\n\n")
    for source in report['official_sources_to_check']:
        f.write(f"- {source}\n")
    
    f.write("\n## Immediate Actions Required\n\n")
    for i, step in enumerate(report['next_steps'], 1):
        f.write(f"{i}. {step}\n")
    
    f.write(f"\n## Recommendations\n\n")
    rec = report['recommendations']
    f.write(f"**Immediate:** {rec['immediate']}\n\n")
    f.write(f"**Short-term:** {rec['short_term']}\n\n")
    f.write(f"**Long-term:** {rec['long_term']}\n\n")

def main():
    """Main execution function"""
    print("🚀 Raigarh Urban Ward Data Analysis")
    print("=" * 50)
    
    try:
        # Generate comprehensive analysis
        report = generate_comprehensive_summary()
        
        # Save all reports
        json_file, csv_file, md_file = save_comprehensive_report(report)
        
        print("\n" + "=" * 50)
        print("✅ ANALYSIS COMPLETE")
        print("=" * 50)
        
        print(f"\n📊 KEY FINDINGS:")
        analysis = report['assembly_constituency_analysis']
        print(f"  Rural Data: ✅ Complete ({analysis['total_gram_panchayats']} GPs, {analysis['total_villages']} villages)")
        print(f"  Urban Ward Data: ❌ Not available in current dataset")
        print(f"  ULBs Identified: {'Yes' if analysis['urban_areas_found'] else 'No'}")
        
        print(f"\n📁 OUTPUT FILES:")
        print(f"  - Analysis: {json_file}")
        print(f"  - Template: {csv_file}")
        print(f"  - Summary: {md_file}")
        
        print(f"\n🎯 NEXT STEPS:")
        for step in report['next_steps'][:3]:
            print(f"  - {step}")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Analysis failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)