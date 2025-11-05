from indicnlp.normalize.indic_normalize import IndicNormalizerFactory

# The normalizer factory is created once and reused
factory = IndicNormalizerFactory()
normalizer = factory.get_normalizer("hi", remove_nuktas=True)

def nukta_fold(text):
    """Removes the nukta from Devanagari characters in a string."""
    return normalizer.normalize(text)

def transliterate_devanagari_to_latin(text):
    """(Not yet implemented) Transliterates Devanagari text to Latin (Roman) script."""
    # TODO: Fix implementation based on indic-nlp-library usage
    return text

def handle_hinglish_phonetics(text):
    """(Not yet implemented) Handles Hinglish phonetic variations."""
    # TODO: Implement this
    return text

def handle_schwa(text):
    """(Not yet implemented) Handles schwa deletion in Hindi words."""
    # TODO: Implement this
    return text

def dedupe(text_list):
    """Deduplicates a list of strings."""
    return list(dict.fromkeys(text_list))
