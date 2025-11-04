import langextract as lx
from .prompts import EXTRACTION_PROMPTS
import google.generativeai as genai
import time
import threading
from queue import Queue
from typing import Dict, Any, Optional
import os
from datetime import datetime, timedelta

class RateLimiter:
    """Token bucket rate limiter for Gemini API"""

    def __init__(self, requests_per_minute: int = 60, burst_size: int = 10):
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.tokens = burst_size
        self.last_refill = datetime.now()
        self.lock = threading.Lock()

    def _refill_tokens(self):
        """Refill tokens based on time elapsed"""
        now = datetime.now()
        time_passed = (now - self.last_refill).total_seconds()
        tokens_to_add = (time_passed / 60) * self.requests_per_minute

        self.tokens = min(self.burst_size, self.tokens + tokens_to_add)
        self.last_refill = now

    def acquire(self) -> bool:
        """Try to acquire a token. Returns True if successful, False if rate limited."""
        with self.lock:
            self._refill_tokens()
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

    def wait_for_token(self, timeout: float = 60.0) -> bool:
        """Wait for a token to become available. Returns True if acquired, False if timeout."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.acquire():
                return True
            time.sleep(1)  # Wait 1 second before trying again
        return False

class GeminiParser:
    """Gemini-based parser with proper rate limiting"""

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-1.5-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")

        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(model_name)

        # Rate limiter: 60 requests per minute with burst of 10
        self.rate_limiter = RateLimiter(requests_per_minute=60, burst_size=10)

        # Request queue for async processing
        self.request_queue = Queue()
        self.response_cache: Dict[str, str] = {}

        # Start background worker
        self.worker_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.worker_thread.start()

    def _get_cache_key(self, text: str, entity: str) -> str:
        """Generate cache key for text-entity pair"""
        return f"{hash(text)}:{entity}"

    def _process_queue(self):
        """Background worker to process queued requests"""
        while True:
            try:
                request = self.request_queue.get(timeout=1)
                if request:
                    self._process_request(request)
            except:
                continue

    def _process_request(self, request: Dict[str, Any]):
        """Process a single request from the queue"""
        text = request['text']
        entity = request['entity']
        callback = request['callback']

        try:
            result = self._call_gemini(text, entity)
            callback(result, None)
        except Exception as e:
            callback(None, str(e))

    def _call_gemini(self, text: str, entity: str) -> str:
        """Make actual Gemini API call with rate limiting"""
        if not self.rate_limiter.wait_for_token():
            raise Exception("Rate limit timeout - unable to acquire token")

        prompt_info = EXTRACTION_PROMPTS[entity]
        prompt = f"""
        Extract the specified information from the following text.

        Text: "{text}"

        Information to extract: {prompt_info["prompt"].split("Information to extract:")[1].strip()}

        Please provide only the extracted information without any additional text.
        """

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            # Handle specific Gemini errors
            if "RATE_LIMIT_EXCEEDED" in str(e):
                # Wait longer and retry once
                time.sleep(10)
                if self.rate_limiter.wait_for_token():
                    response = self.model.generate_content(prompt)
                    return response.text.strip()
            raise e

    def parse(self, text: str, entity: str) -> str:
        """Parse text for entity with caching and rate limiting"""
        if entity not in EXTRACTION_PROMPTS:
            raise ValueError(f"Unknown entity type: {entity}")

        cache_key = self._get_cache_key(text, entity)
        if cache_key in self.response_cache:
            return self.response_cache[cache_key]

        # For immediate response, use synchronous call
        try:
            result = self._call_gemini(text, entity)
            self.response_cache[cache_key] = result
            return result
        except Exception as e:
            print(f"Error parsing {entity}: {e}")
            return "unknown"

    def parse_async(self, text: str, entity: str, callback):
        """Parse text asynchronously"""
        if entity not in EXTRACTION_PROMPTS:
            raise ValueError(f"Unknown entity type: {entity}")

        cache_key = self._get_cache_key(text, entity)
        if cache_key in self.response_cache:
            callback(self.response_cache[cache_key], None)
            return

        # Queue the request for background processing
        self.request_queue.put({
            'text': text,
            'entity': entity,
            'callback': lambda result, error: self._handle_async_response(cache_key, result, error, callback)
        })

    def _handle_async_response(self, cache_key: str, result: Optional[str], error: Optional[str], callback):
        """Handle async response and update cache"""
        if result:
            self.response_cache[cache_key] = result
        callback(result, error)

    def get_rate_limit_status(self) -> Dict[str, Any]:
        """Get current rate limiting status"""
        return {
            "tokens_available": self.rate_limiter.tokens,
            "requests_per_minute": self.rate_limiter.requests_per_minute,
            "burst_size": self.rate_limiter.burst_size,
            "queue_size": self.request_queue.qsize(),
            "cache_size": len(self.response_cache)
        }

class LangExtractParser:
    """Original LangExtract parser for fallback"""

    def __init__(self):
        self.prompts = EXTRACTION_PROMPTS

    def parse(self, text: str, entity: str) -> str:
        if entity not in self.prompts:
            raise ValueError(f"Unknown entity type: {entity}")

        prompt_info = self.prompts[entity]
        prompt_description = prompt_info["prompt"].split("Information to extract:")[1].strip()

        examples = prompt_info["examples"]

        result = lx.extract(
            text_or_documents=text,
            prompt_description=prompt_description,
            examples=examples,
            model_id="gemma2:2b",
            model_url="http://localhost:11434"
        )

        try:
            extracted_text = result['extractions'][0]['text']
        except (KeyError, IndexError, TypeError, AttributeError):
            extracted_text = "unknown"

        return extracted_text

# Factory function to create appropriate parser
def create_parser(parser_type: str = "gemini", **kwargs):
    """Factory function to create parser with proper configuration"""
    if parser_type == "gemini":
        return GeminiParser(**kwargs)
    elif parser_type == "langextract":
        return LangExtractParser()
    else:
        raise ValueError(f"Unknown parser type: {parser_type}")
