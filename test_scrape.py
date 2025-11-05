# test_scrape.py
# This script will log into X, navigate to a user's profile, and scrape the 5 most recent tweets.

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
import pandas as pd
import time
import re

# --- CONFIGURATION: EDIT THESE VALUES ---
# IMPORTANT: Use a throwaway account, not your main account.
USERNAME_X = "your_x_username"  # Your X handle
PASSWORD_X = "your_x_password"  # Your password

TARGET_USER = "OPChoudhary_Ind"
START_DATE = datetime(2023, 12, 1)
# Make sure chromedriver.exe (or chromedriver on Mac/Linux) is in the same folder as this script
CHROMEDRIVER_PATH = "chromedriver.exe" 
OUTPUT_CSV = f"{TARGET_USER}_test_scrape_5_tweets.csv"
# --- END OF CONFIGURATION ---

service = Service(CHROMEDRIVER_PATH)
options = webdriver.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
# The script is easier to debug with the browser visible. Add "--headless" to run in the background.
# options.add_argument("--headless") 
driver = webdriver.Chrome(service=service, options=options)
wait = WebDriverWait(driver, 15)

def login():
    """Navigates to the X login page and enters credentials."""
    try:
        print("Attempting to log in...")
        driver.get("https://x.com/login")
        # Wait for the username input field and enter the username
        username_field = wait.until(EC.presence_of_element_located((By.NAME, "text")))
        username_field.send_keys(USERNAME_X)
        # Find and click the 'Next' button
        driver.find_element(By.XPATH, '//span[contains(text(), "Next")]').click()
        
        # Wait for the password input field and enter the password
        password_field = wait.until(EC.presence_of_element_located((By.NAME, "password")))
        password_field.send_keys(PASSWORD_X)
        # Find and click the 'Log in' button
        driver.find_element(By.XPATH, '//span[contains(text(), "Log in")]').click()

        # Wait for the main timeline to appear to confirm login
        wait.until(EC.presence_of_element_located((By.XPATH, '//a[@data-testid="AppTabBar_Home_Link"]')))
        print("Logged in successfully.")
        return True
    except Exception as e:
        print(f"Login failed. Error: {e}")
        print("The script may fail if X has changed its login page structure or if credentials are incorrect.")
        return False

def parse_tweet(element):
    """Extracts desired information from a single tweet element."""
    try:
        # Extract tweet text
        text_elem = element.find_element(By.CSS_SELECTOR, '[data-testid="tweetText"]')
        text = text_elem.text
        
        # Extract timestamp
        time_elem = element.find_element(By.CSS_SELECTOR, 'time')
        date_str = time_elem.get_attribute("datetime")
        date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        
        # This script won't go back far enough to hit the start date, but the logic is here for longer runs
        if date < START_DATE:
            return "STOP"
            
        # Extract likes (handles formats like 1,234, 1.5K, 1M)
        likes_text = element.find_element(By.XPATH, './/div[contains(@data-testid, "like")]/div[2]').text
        likes = re.search(r'([\d,.KMB]+)', likes_text).group(1) if re.search(r'([\d,.KMB]+)', likes_text) else '0'
        
        return {'date': date.strftime('%Y-%m-%d %H:%M'), 'text': text, 'likes': likes}
    except Exception:
        # This can happen for non-standard tweets (e.g., ads, "who to follow"). It's safe to ignore.
        return None

# --- Main Script Execution ---
if login():
    print(f"Navigating to {TARGET_USER}'s profile...")
    driver.get(f"https://x.com/{TARGET_USER}")
    time.sleep(5) # Allow page to load

    tweets = []
    
    # We will loop until we have 5 tweets or something goes wrong
    while len(tweets) < 5:
        # Find all tweet elements currently on the page
        elements = driver.find_elements(By.CSS_SELECTOR, '[data-testid="tweet"]')
        
        if not elements:
            print("No tweet elements found. The page structure may have changed.")
            break

        for elem in elements:
            # Stop if we have enough tweets
            if len(tweets) >= 5:
                break
            
            parsed = parse_tweet(elem)
            
            if parsed == "STOP": # Reached older tweets than START_DATE
                break
            
            if parsed:
                # Add to list if the tweet text is not already there
                if not any(t['text'] == parsed['text'] for t in tweets):
                    print(f"Scraped tweet #{len(tweets) + 1}: {parsed['text'][:50]}...")
                    tweets.append(parsed)

        # If we have enough tweets, exit the loop
        if len(tweets) >= 5:
            print("Successfully scraped 5 tweets.")
            break
        
        # Scroll down to load more tweets
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        print("Scrolling down to load more tweets...")
        time.sleep(3) # Wait for new tweets to load

driver.quit()

# --- Save the results ---
if tweets:
    df = pd.DataFrame(tweets)
    df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
    print(f"\nSaved {len(df)} unique tweets to {OUTPUT_CSV}")
else:
    print("\nNo tweets were scraped. Please check the browser window for errors (e.g., CAPTCHA, changed layout).")
