#!/usr/bin/env python3
"""
Entry point for running semantic location linker tests as a module.

Usage:
    python -m src.parsing.semantic_location_linker_test "रायगढ़ कलेक्टरेट"
"""

from .semantic_location_linker_test import main

if __name__ == '__main__':
    import sys
    sys.exit(main())