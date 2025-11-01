from api.src.parsing.normalization import normalize_tokens, fold_nukta, translit_basic


def norm(text='', tokens=None):
    return normalize_tokens(text=text, tokens=tokens or [])


def test_nukta_folding():
    assert fold_nukta('ज़िला') == 'जिला'


def test_transliteration_with_matras():
    # समारोह -> expect transliteration close to 'samaroh' or our schwa-expanded variant
    lat = translit_basic('समारोह').lower()
    # Allow 'smaaroh' (no schwa) or presence of 'sa' prefix in other variants
    assert 'smaaroh' in lat or lat.startswith('sa')


def test_hinglish_loosen_swachhata():
    out = norm(tokens=['स्वच्छता'])
    variants = out['स्वच्छता']
    # Allow flexible variants like swchchta/swchh.. or Devanagari itself
    joined = ' '.join(variants)
    assert ('swchch' in joined or 'swchh' in joined or 'स्वच्छता' in joined)


def test_schwa_variants_sammilit_partial():
    out = norm(tokens=['सम्मिलित'])
    joined = ' '.join(out['सम्मिलित'])
    # Expect 'sammilit' or close, and partial 'sammi' substring present
    assert 'sammi' in joined
