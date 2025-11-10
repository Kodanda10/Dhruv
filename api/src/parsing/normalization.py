import re
from typing import Dict, List, Set

NUKTA_MAP = str.maketrans({
  'क़':'क','ख़':'ख','ग़':'ग','ज़':'ज','फ़':'फ','ड़':'ड','ढ़':'ढ','ऱ':'र','य़':'य'
})

COMBINING = re.compile(r"[\u093C\u094D\u200C\u200D\uFE00-\uFE0F]")
MATRA_MAP = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ृ': 'ri',
  'ॉ': 'o', 'ॅ': 'ae'
}


def fold_nukta(s: str) -> str:
  return COMBINING.sub('', s.translate(NUKTA_MAP))


def translit_basic(dev: str) -> str:
  # Minimal conservative transliteration for bootstrap; improved later
  m = {
    'अ':'a','आ':'aa','इ':'i','ई':'ii','उ':'u','ऊ':'uu','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
    'क':'k','ख':'kh','ग':'g','घ':'gh','च':'ch','छ':'chh','ज':'j','झ':'jh','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n',
    'त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'ph','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h'
  }
  out = []
  for ch in dev:
    if ch in MATRA_MAP:
      out.append(MATRA_MAP[ch])
    else:
      out.append(m.get(ch, ch))
  return ''.join(out)


def loosen_hinglish(s: str) -> str:
  return (
    s.replace('chh','ch')
     .replace('sh','s')
     .replace('th','t')
     .replace('dh','d')
     .replace('ph','f')
  )


def expand_hinglish_variants(s: str) -> Set[str]:
  out: Set[str] = {s}
  # v/w swaps
  out.add(s.replace('v', 'w'))
  out.add(s.replace('w', 'v'))
  # chch -> chh/ch
  out.add(s.replace('chch', 'chh'))
  out.add(s.replace('chch', 'ch'))
  # also chain with swaps
  for v in list(out):
    out.add(v.replace('v', 'w'))
    out.add(v.replace('w', 'v'))
  return out


def schwa_variants(lat: str) -> Set[str]:
  out: Set[str] = {lat}
  if lat.endswith('a'):
    out.add(lat[:-1])
  if lat and lat[0].isalpha() and lat[0] not in 'aeiou':
    out.add(lat[0] + 'a' + lat[1:])
  return out

def normalize_tokens(text: str, tokens: List[str]) -> Dict[str, List[str]]:
  items = tokens or re.findall(r"[#@]?[\w\u0900-\u097F]+", text or '')
  normalized: Dict[str, List[str]] = {}
  for t in items:
    base = t.strip()
    if not base:
      continue
    d = fold_nukta(base)
    lat = translit_basic(d).lower()
    lat2 = loosen_hinglish(lat)
    variants: Set[str] = {base, base.lower(), d, lat, lat2}
    variants |= expand_hinglish_variants(lat)
    variants |= expand_hinglish_variants(lat2)
    variants |= schwa_variants(lat)
    variants |= schwa_variants(lat2)
    variants |= {re.sub(r'(.)\1+', r'\1', v) for v in list(variants)}
    normalized[base] = list(variants)
  return normalized
