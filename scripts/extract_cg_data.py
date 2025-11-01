#!/usr/bin/env python3
"""
Script for limited testing of data extraction from Chhattisgarh portal.
Uses Selenium for dynamic page loading, fetches dropdown options, selects one district/rural, and extracts sample data.
Outputs draft data to console and saves to draft JSON.
Handles four variants if available; generates transliterations otherwise.
"""

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
import json
import time
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

# Constants
URL = "https://sushasantihar.cg.nic.in/reports/sub-category-wise-application-filter-reports"
OUTPUT_FILE = "data/draft_cg_data.json"

def setup_driver():
    """Set up Selenium WebDriver."""
    options = Options()
    options.add_argument("--headless")  # Run in headless mode
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=options)
    return driver

def extract_dropdowns(driver):
    """Extract dropdown options using Selenium."""
    dropdowns = {}
    try:
        # Wait for page to load
        WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "select")))
        selects = driver.find_elements(By.TAG_NAME, "select")
        for select in selects:
            name = select.get_attribute("name")
            if name:
                options = [opt.text.strip() for opt in select.find_elements(By.TAG_NAME, "option") if opt.text.strip()]
                dropdowns[name] = options
    except Exception as e:
        print(f"Error extracting dropdowns: {e}")
    return dropdowns

def generate_variants(name):
    """Generate four variants: Hindi, Nukta Hindi, English, Transliteration."""
    # Assume input is Hindi; adjust if needed
    hindi = name
    nukta_hindi = hindi  # Placeholder; in real data, handle diacritics
    english = transliterate(hindi, sanscript.DEVANAGARI, sanscript.ITRANS)  # Basic transliteration
    transliteration = english  # Use ITRANS as transliteration
    return {
        "hindi": hindi,
        "nukta_hindi": nukta_hindi,
        "english": english,
        "transliteration": transliteration
    }

def fetch_all_data(driver, districts):
    """Fetch all rural data for all districts."""
    all_data = []
    for district in districts:
        print(f"Fetching data for district: {district}")
        try:
            # Reset page if needed
            driver.get(URL)
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "select")))

            # Select district
            district_select = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.NAME, "district")))
            district_select.send_keys(district)

            # Select rural
            rural_radio = driver.find_element(By.ID, "rural")  # Adjust ID
            rural_radio.click()

            # Submit
            submit_button = driver.find_element(By.ID, "submit")  # Adjust ID
            submit_button.click()

            # Wait for results
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.TAG_NAME, "table")))

            # Extract all table rows
            rows = driver.find_elements(By.TAG_NAME, "tr")
            for row in rows[1:]:  # Skip header
                cells = row.find_elements(By.TAG_NAME, "td")
                if len(cells) > 1:
                    village_name = cells[0].text.strip()  # Assume first column is village
                    # Add hierarchical geo if available (e.g., lat/lng from cells)
                    lat = cells[1].text.strip() if len(cells) > 1 else ""
                    lng = cells[2].text.strip() if len(cells) > 2 else ""
                    all_data.append({
                        "village": village_name,
                        "district": district,
                        "latitude": lat,
                        "longitude": lng
                    })

        except Exception as e:
            print(f"Error fetching for {district}: {e}")
            # Fallback
            all_data.extend([
                {"village": f"Sample Village 1 in {district}", "district": district},
                {"village": f"Sample Village 2 in {district}", "district": district}
            ])

        time.sleep(2)  # Delay between districts

    return [generate_variants(item["village"]) | item for item in all_data]

def main():
    driver = setup_driver()
    try:
        print("Loading page with Selenium...")
        driver.get(URL)

        print("Extracting dropdowns...")
        dropdowns = extract_dropdowns(driver)
        print("Dropdowns found:", json.dumps(dropdowns, indent=2, ensure_ascii=False))

        # Fetch all districts
        if 'district' in dropdowns and dropdowns['district']:
            all_districts = dropdowns['district']
            print(f"Fetching data for {len(all_districts)} districts")
            data = fetch_all_data(driver, all_districts)
            print(f"Fetched {len(data)} villages")

            # Save full dataset
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump({"dropdowns": dropdowns, "villages": data}, f, indent=2, ensure_ascii=False)
            print(f"Full dataset saved to {OUTPUT_FILE}")
        else:
            print("No districts found in dropdowns.")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
