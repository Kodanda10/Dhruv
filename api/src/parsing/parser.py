import langextract as lx
from .prompts import EXTRACTION_PROMPTS

class LangExtractParser:
    def __init__(self):
        self.prompts = EXTRACTION_PROMPTS

    def parse(self, text: str, entity: str) -> str:
        if entity not in self.prompts:
            raise ValueError(f"Unknown entity type: {entity}")

        prompt_info = self.prompts[entity]
        # The prompt from the user example is just the description, not the formatted text
        # This is a bit of a hack to extract the description from the prompt template
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
            # The result is a list of documents, get the first one
            # Then get the first extraction's text
            extracted_text = result['extractions'][0]['text']
        except (KeyError, IndexError, TypeError, AttributeError):
            extracted_text = "unknown"
            
        return extracted_text
