from langextract import data

# A generic prompt structure that can be adapted
BASE_PROMPT_TEMPLATE = """
Extract the specified information from the following text.

Text: "{text}"

Information to extract: {entity_name}
"""

# Specific prompts for different entities
EXTRACTION_PROMPTS = {
    "theme": {
        "prompt": BASE_PROMPT_TEMPLATE.format(
            text="{text}",
            entity_name="The main theme or topic. Examples: 'महिला सशक्तिकरण', 'विकास कार्य', 'स्वास्थ्य', 'राजनीति'."
        ),
        "examples": [
            data.ExampleData(text="आज रायगढ़ में विकास कार्यों की समीक्षा की। #विकास", extractions=[data.Extraction(extraction_class="theme", extraction_text="विकास कार्य")]),
            data.ExampleData(text="महिला स्व-सहायता समूहों से संवाद।", extractions=[data.Extraction(extraction_class="theme", extraction_text="महिला सशक्तिकरण")]),
        ]
    },
    "sentiment": {
        "prompt": BASE_PROMPT_TEMPLATE.format(
            text="{text}",
            entity_name="The sentiment of the text. Choose from: 'positive', 'negative', 'neutral'."
        ),
        "examples": [
            data.ExampleData(text="प्रदेशवासियों की सुख-समृद्धि की प्रार्थना।", extractions=[data.Extraction(extraction_class="sentiment", extraction_text="positive")]),
            data.ExampleData(text="दर्दनाक हादसे में तीन लोगों की मृत्यु...", extractions=[data.Extraction(extraction_class="sentiment", extraction_text="negative")]),
        ]
    },
    "location": {
        "prompt": BASE_PROMPT_TEMPLATE.format(
            text="{text}",
            entity_name="The primary location mentioned. Example: 'रायपुर', 'दिल्ली'."
        ),
        "examples": [
            data.ExampleData(text="आज रायगढ़ में विकास कार्यों की समीक्षा की।", extractions=[data.Extraction(extraction_class="location", extraction_text="रायगढ़")]),
            data.ExampleData(text="दिल्ली में बैठक में सम्मिलित हुआ।", extractions=[data.Extraction(extraction_class="location", extraction_text="दिल्ली")]),
        ]
    }
}