import unittest
from unittest.mock import patch, MagicMock

# Make sure the app path is in sys.path to import the parser
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

from parsing.parser import LangExtractParser
from parsing.prompts import EXTRACTION_PROMPTS

class TestLangExtractParser(unittest.TestCase):

    def setUp(self):
        """Set up a new parser for each test."""
        self.parser = LangExtractParser()

    def test_initialization(self):
        """Test that the parser initializes correctly and loads prompts."""
        self.assertIsNotNone(self.parser)
        self.assertEqual(self.parser.prompts, EXTRACTION_PROMPTS)

    @patch('parsing.parser.lx.extract')
    def test_parse_method_calls_extract(self, mock_extract):
        """Test that the parse method calls the langextract.extract function correctly."""
        # Configure the mock to return a specific value
        mock_extract.return_value = {'extractions': [{'text': 'विकास कार्य'}]}

        text_to_parse = "आज रायगढ़ में विकास कार्यों की समीक्षा की। #विकास"
        entity_to_extract = "theme"
        
        # Call the method to be tested
        result = self.parser.parse(text_to_parse, entity_to_extract)

        # Assert the mock was called
        mock_extract.assert_called_once()
        
        # Assert the result is what the mock returned
        self.assertEqual(result, "विकास कार्य")

    def test_parse_with_unknown_entity_raises_error(self):
        """Test that a ValueError is raised for an unknown entity type."""
        with self.assertRaises(ValueError):
            self.parser.parse("some text", "unknown_entity")

if __name__ == '__main__':
    unittest.main()
