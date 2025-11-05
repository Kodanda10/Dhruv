import pytest
from normalization import nukta_fold, transliterate_devanagari_to_latin, handle_hinglish_phonetics, handle_schwa, dedupe

def test_nukta_fold():
    assert nukta_fold('ज़िंदगी') == 'जिंदगी'

@pytest.mark.xfail(reason="indic-nlp-library usage needs to be corrected")
def test_transliterate():
    assert transliterate_devanagari_to_latin('नमस्ते') == 'namaste'

@pytest.mark.skip(reason="Not yet implemented")
def test_handle_hinglish_phonetics():
    pass

@pytest.mark.skip(reason="Not yet implemented")
def test_handle_schwa():
    pass

def test_dedupe():
    assert dedupe(['a', 'b', 'a']) == ['a', 'b']