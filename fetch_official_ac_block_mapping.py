#!/usr/bin/env python3
"""
Official AC-to-Block Mapping Fetcher from Election Commission
============================================================

This script fetches official Assembly Constituency to Block mapping 
from the Election Commission of India and Chhattisgarh State Election Commission.

Target: रायगढ़ Assembly Constituency block mapping verification

Official Sources:
1. Election Commission of India (eci.gov.in)
2. Chhattisgarh State Election Commission (ceo.cg.nic.in)
3. National Informatics Centre (cg.nic.in)
4. Census 2011 Administrative Atlas

Generated: October 2025
"""

import requests
import json
import csv
import time
from datetime import datetime
from urllib.parse import urljoin, quote
import logging
from pathlib import Path
import re
from bs4 import BeautifulSoup
import pandas as pd

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class OfficialACBlockMapper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        })
        
        # Official Election Commission URLs
        self.sources = {
            'eci_main': 'https://eci.gov.in',
            'cg_ceo': 'https://ceo.cg.nic.in',
            'cg_state': 'https://cg.nic.in',
            'census_admin': 'https://censusindia.gov.in',
            'delimitation': 'https://eci.gov.in/files/category/1663-delimitation-2008/',
        }
        
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'target_constituency': 'रायगढ़',
            'sources_attempted': [],
            'mapping_found': {},
            'raw_data': {},
            'verification_status': 'pending'
        }
    
    def fetch_eci_delimitation_data(self):
        """Fetch delimitation data from ECI"""
        logger.info("🏛️ Fetching ECI Delimitation Commission data...")
        
        delimitation_data = {
            'source': 'Election Commission of India - Delimitation 2008',
            'url': self.sources['delimitation'],
            'data_found': False,
            'details': {}
        }
        
        try:
            # Try to access ECI delimitation documents
            response = self.session.get(self.sources['delimitation'], timeout=15)
            
            if response.status_code == 200:
                logger.info("✅ ECI delimitation page accessible")
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for Chhattisgarh-related documents
                cg_links = []
                for link in soup.find_all('a', href=True):
                    href = link.get('href', '')
                    text = link.get_text().strip()
                    
                    if ('chhattisgarh' in text.lower() or 'cg' in text.lower() or
                        'छत्तीसगढ़' in text):
                        cg_links.append({
                            'text': text,
                            'url': urljoin(self.sources['delimitation'], href)
                        })
                
                delimitation_data['details']['cg_documents'] = cg_links
                delimitation_data['data_found'] = len(cg_links) > 0
                
                logger.info(f"Found {len(cg_links)} Chhattisgarh-related documents")
                
            else:
                logger.warning(f"ECI delimitation page returned status {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to fetch ECI delimitation data: {str(e)}")
            delimitation_data['error'] = str(e)
        
        self.results['sources_attempted'].append('eci_delimitation')
        self.results['raw_data']['eci_delimitation'] = delimitation_data
        return delimitation_data
    
    def fetch_cg_ceo_data(self):
        """Fetch data from Chhattisgarh Chief Electoral Officer"""
        logger.info("🏛️ Fetching Chhattisgarh CEO data...")
        
        ceo_data = {
            'source': 'Chhattisgarh Chief Electoral Officer',
            'url': self.sources['cg_ceo'],
            'data_found': False,
            'details': {}
        }
        
        try:
            # Access CEO main page
            response = self.session.get(self.sources['cg_ceo'], timeout=15)
            
            if response.status_code == 200:
                logger.info("✅ CG CEO website accessible")
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # Look for constituency-related sections
                constituency_links = []
                relevant_keywords = ['constituency', 'विधानसभा', 'assembly', 'रायगढ़', 'delimitation']
                
                for link in soup.find_all('a', href=True):
                    text = link.get_text().strip().lower()
                    href = link.get('href', '')
                    
                    if any(keyword in text for keyword in relevant_keywords):
                        constituency_links.append({
                            'text': link.get_text().strip(),
                            'url': urljoin(self.sources['cg_ceo'], href)
                        })
                
                ceo_data['details']['constituency_links'] = constituency_links
                ceo_data['data_found'] = len(constituency_links) > 0
                
                # Try to find specific API endpoints
                api_patterns = [
                    '/api/constituencies',
                    '/data/assembly',
                    '/constituency-data',
                    '/mapping'
                ]
                
                potential_apis = []
                for pattern in api_patterns:
                    api_url = urljoin(self.sources['cg_ceo'], pattern)
                    try:
                        api_response = self.session.get(api_url, timeout=5)
                        if api_response.status_code == 200:
                            potential_apis.append(api_url)
                    except:
                        pass
                
                ceo_data['details']['api_endpoints'] = potential_apis
                logger.info(f"Found {len(constituency_links)} constituency-related links")
                logger.info(f"Found {len(potential_apis)} potential API endpoints")
                
            else:
                logger.warning(f"CG CEO website returned status {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to fetch CG CEO data: {str(e)}")
            ceo_data['error'] = str(e)
        
        self.results['sources_attempted'].append('cg_ceo')
        self.results['raw_data']['cg_ceo'] = ceo_data
        return ceo_data
    
    def fetch_census_admin_atlas(self):
        """Fetch Census Administrative Atlas data"""
        logger.info("📊 Fetching Census Administrative Atlas...")
        
        census_data = {
            'source': 'Census of India - Administrative Atlas',
            'url': self.sources['census_admin'],
            'data_found': False,
            'details': {}
        }
        
        try:
            # Census administrative boundaries
            census_urls = [
                'https://censusindia.gov.in/2011census/maps/administrative_maps/index.html',
                'https://censusindia.gov.in/maps/index.html',
                'https://censusindia.gov.in/2011-prov-results/paper2-vol2/data_files/chhattisgarh/Administrative%20Atlas-CG.pdf'
            ]
            
            accessible_urls = []
            for url in census_urls:
                try:
                    response = self.session.get(url, timeout=10)
                    if response.status_code == 200:
                        accessible_urls.append(url)
                        logger.info(f"✅ Accessible: {url}")
                    else:
                        logger.warning(f"❌ Status {response.status_code}: {url}")
                except Exception as e:
                    logger.warning(f"❌ Error accessing {url}: {str(e)}")
            
            census_data['details']['accessible_urls'] = accessible_urls
            census_data['data_found'] = len(accessible_urls) > 0
            
        except Exception as e:
            logger.error(f"Failed to fetch Census data: {str(e)}")
            census_data['error'] = str(e)
        
        self.results['sources_attempted'].append('census_admin')
        self.results['raw_data']['census_admin'] = census_data
        return census_data
    
    def search_specific_raigarh_mapping(self):
        """Search for specific Raigarh AC mapping"""
        logger.info("🔍 Searching for specific Raigarh AC-to-Block mapping...")
        
        search_data = {
            'source': 'Targeted Search',
            'queries_attempted': [],
            'data_found': False,
            'details': {}
        }
        
        # Specific search queries for Raigarh AC mapping
        search_queries = [
            'रायगढ़ विधानसभा क्षेत्र ब्लॉक मैपिंग',
            'Raigarh Assembly Constituency blocks',
            'रायगढ़ AC block mapping Chhattisgarh',
            'Election Commission Raigarh constituency boundaries',
            'Delimitation Commission Raigarh blocks'
        ]
        
        # URLs to check for specific data
        specific_urls = [
            'https://ceo.cg.nic.in/downloads/',
            'https://cg.nic.in/election/',
            'https://eci.gov.in/files/category/1663-delimitation-2008/',
            'https://censusindia.gov.in/2011census/maps/administrative_maps/',
        ]
        
        results = []
        for url in specific_urls:
            try:
                response = self.session.get(url, timeout=10)
                if response.status_code == 200:
                    content = response.text.lower()
                    if 'raigarh' in content or 'रायगढ़' in response.text:
                        results.append({
                            'url': url,
                            'contains_raigarh': True,
                            'status': 'success'
                        })
                        logger.info(f"✅ Found Raigarh reference in: {url}")
                    else:
                        results.append({
                            'url': url,
                            'contains_raigarh': False,
                            'status': 'no_match'
                        })
                else:
                    results.append({
                        'url': url,
                        'status': f'error_{response.status_code}'
                    })
            except Exception as e:
                results.append({
                    'url': url,
                    'status': f'error_{str(e)}'
                })
        
        search_data['details']['url_results'] = results
        search_data['data_found'] = any(r.get('contains_raigarh', False) for r in results)
        
        self.results['sources_attempted'].append('targeted_search')
        self.results['raw_data']['targeted_search'] = search_data
        return search_data
    
    def analyze_known_patterns(self):
        """Analyze known patterns in Indian AC-Block mappings"""
        logger.info("🧠 Analyzing known AC-Block mapping patterns...")
        
        pattern_analysis = {
            'source': 'Pattern Analysis',
            'patterns_identified': [],
            'recommendations': []
        }
        
        # Common patterns in Indian states
        patterns = [
            {
                'pattern': 'Same Name Mapping',
                'description': 'AC and Block have the same name',
                'applies_to_raigarh': True,
                'confidence': 'High',
                'evidence': 'Both रायगढ़ AC and रायगढ़ Block exist'
            },
            {
                'pattern': 'District Headquarters',
                'description': 'District HQ block usually maps to main AC',
                'applies_to_raigarh': True,
                'confidence': 'Medium',
                'evidence': 'रायगढ़ is district headquarters'
            },
            {
                'pattern': 'Urban-Rural Split',
                'description': 'Urban areas in separate AC from rural blocks',
                'applies_to_raigarh': False,
                'confidence': 'Low',
                'evidence': 'रायगढ़ AC likely includes both urban and rural'
            }
        ]
        
        pattern_analysis['patterns_identified'] = patterns
        
        # Generate recommendations based on patterns
        recommendations = [
            'रायगढ़ AC likely includes रायगढ़ Block (same name pattern)',
            'Check if रायगढ़ AC includes neighboring blocks',
            'Verify urban area coverage within रायगढ़ Block',
            'Cross-reference with polling station assignments'
        ]
        
        pattern_analysis['recommendations'] = recommendations
        
        self.results['raw_data']['pattern_analysis'] = pattern_analysis
        return pattern_analysis
    
    def generate_mapping_report(self):
        """Generate comprehensive AC-Block mapping report"""
        logger.info("📋 Generating comprehensive mapping report...")
        
        # Fetch data from all sources
        eci_data = self.fetch_eci_delimitation_data()
        ceo_data = self.fetch_cg_ceo_data()
        census_data = self.fetch_census_admin_atlas()
        search_data = self.search_specific_raigarh_mapping()
        pattern_data = self.analyze_known_patterns()
        
        # Compile results
        report = {
            'generation_timestamp': datetime.now().isoformat(),
            'target_analysis': {
                'constituency': 'रायगढ़',
                'district': 'रायगढ़',
                'state': 'Chhattisgarh'
            },
            'official_sources_checked': len(self.results['sources_attempted']),
            'data_sources': self.results['raw_data'],
            'findings': {
                'definitive_mapping': None,
                'probable_blocks': ['रायगढ़'],
                'confidence_level': 'Medium - Based on name matching pattern',
                'verification_needed': True
            },
            'recommendations': [
                'Contact Chhattisgarh CEO office directly for official mapping',
                'Request delimitation commission documents from ECI',
                'Cross-verify with district election office records',
                'Check polling station assignments for block verification'
            ],
            'next_steps': [
                'Phone call to CEO Chhattisgarh: +91-771-2443041',
                'Email request to: ceo-cg@nic.in',
                'Visit district election office in Raigarh',
                'Request RTI for constituency boundary documents'
            ]
        }
        
        # Update overall results
        self.results.update(report)
        
        return report
    
    def save_mapping_report(self, report):
        """Save the mapping report to files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save JSON report
        json_file = f'data/raigarh_ac_block_mapping_search_{timestamp}.json'
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        # Save human-readable summary
        summary_file = f'data/raigarh_ac_block_mapping_summary_{timestamp}.md'
        with open(summary_file, 'w', encoding='utf-8') as f:
            self.write_mapping_summary(f, report)
        
        # Save contact list for follow-up
        contacts_file = f'data/raigarh_official_contacts_{timestamp}.csv'
        self.save_official_contacts(contacts_file)
        
        logger.info(f"📄 Mapping search report saved:")
        logger.info(f"  - JSON: {json_file}")
        logger.info(f"  - Summary: {summary_file}")
        logger.info(f"  - Contacts: {contacts_file}")
        
        return json_file, summary_file, contacts_file
    
    def write_mapping_summary(self, f, report):
        """Write human-readable mapping summary"""
        f.write("# रायगढ़ Assembly Constituency - Official Block Mapping Search\n\n")
        f.write(f"**Generated:** {report['generation_timestamp']}\n")
        f.write(f"**Target:** {report['target_analysis']['constituency']} Assembly Constituency\n\n")
        
        f.write("## Search Results Summary\n\n")
        f.write(f"- **Official Sources Checked:** {report['official_sources_checked']}\n")
        f.write(f"- **Definitive Mapping Found:** {'No' if report['findings']['definitive_mapping'] is None else 'Yes'}\n")
        f.write(f"- **Confidence Level:** {report['findings']['confidence_level']}\n")
        f.write(f"- **Verification Required:** {'Yes' if report['findings']['verification_needed'] else 'No'}\n\n")
        
        f.write("## Probable Block Assignment\n\n")
        probable_blocks = report['findings']['probable_blocks']
        if probable_blocks:
            f.write("Based on pattern analysis, रायगढ़ AC likely includes:\n\n")
            for block in probable_blocks:
                f.write(f"- **{block}** Block\n")
        else:
            f.write("No probable block assignment determined.\n")
        
        f.write("\n## Official Sources Status\n\n")
        for source_name, source_data in report['data_sources'].items():
            status = "✅ Accessible" if source_data.get('data_found', False) else "❌ No data found"
            f.write(f"- **{source_data['source']}**: {status}\n")
        
        f.write("\n## Immediate Actions Required\n\n")
        for i, action in enumerate(report['next_steps'], 1):
            f.write(f"{i}. {action}\n")
        
        f.write("\n## Pattern Analysis\n\n")
        if 'pattern_analysis' in report['data_sources']:
            patterns = report['data_sources']['pattern_analysis']['patterns_identified']
            for pattern in patterns:
                f.write(f"### {pattern['pattern']}\n")
                f.write(f"- **Description:** {pattern['description']}\n")
                f.write(f"- **Applies to Raigarh:** {pattern['applies_to_raigarh']}\n")
                f.write(f"- **Confidence:** {pattern['confidence']}\n")
                f.write(f"- **Evidence:** {pattern['evidence']}\n\n")
    
    def save_official_contacts(self, filename):
        """Save official contact information for follow-up"""
        contacts = [
            {
                'Organization': 'Chief Electoral Officer, Chhattisgarh',
                'Phone': '+91-771-2443041',
                'Email': 'ceo-cg@nic.in',
                'Website': 'https://ceo.cg.nic.in',
                'Purpose': 'Official AC-to-Block mapping'
            },
            {
                'Organization': 'Election Commission of India',
                'Phone': '+91-11-23052205',
                'Email': 'eci@eci.gov.in',
                'Website': 'https://eci.gov.in',
                'Purpose': 'Delimitation documents'
            },
            {
                'Organization': 'District Election Office, Raigarh',
                'Phone': 'TBD',
                'Email': 'TBD',
                'Website': 'https://raigarh.cgstate.gov.in',
                'Purpose': 'Local constituency boundaries'
            },
            {
                'Organization': 'Census Operations Directorate, CG',
                'Phone': 'TBD',
                'Email': 'TBD',
                'Website': 'https://censusindia.gov.in',
                'Purpose': 'Administrative boundary verification'
            }
        ]
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=contacts[0].keys())
            writer.writeheader()
            writer.writerows(contacts)

def main():
    """Main execution function"""
    print("🚀 Official AC-to-Block Mapping Search for रायगढ़ Assembly Constituency")
    print("=" * 80)
    
    mapper = OfficialACBlockMapper()
    
    try:
        # Generate comprehensive search report
        report = mapper.generate_mapping_report()
        
        # Save all reports
        json_file, summary_file, contacts_file = mapper.save_mapping_report(report)
        
        print("\n" + "=" * 80)
        print("✅ OFFICIAL MAPPING SEARCH COMPLETE")
        print("=" * 80)
        
        print(f"\n📊 SEARCH RESULTS:")
        findings = report['findings']
        print(f"  Definitive Mapping: {'Not Found' if findings['definitive_mapping'] is None else findings['definitive_mapping']}")
        print(f"  Probable Blocks: {', '.join(findings['probable_blocks'])}")
        print(f"  Confidence Level: {findings['confidence_level']}")
        print(f"  Verification Needed: {'Yes' if findings['verification_needed'] else 'No'}")
        
        print(f"\n📁 OUTPUT FILES:")
        print(f"  - Search Report: {json_file}")
        print(f"  - Summary: {summary_file}")
        print(f"  - Official Contacts: {contacts_file}")
        
        print(f"\n🎯 IMMEDIATE NEXT STEPS:")
        for step in report['next_steps'][:3]:
            print(f"  - {step}")
        
        print(f"\n⚠️  IMPORTANT: Manual verification with official sources required!")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Mapping search failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)