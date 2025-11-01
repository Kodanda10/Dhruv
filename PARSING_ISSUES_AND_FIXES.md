# 🔧 Parsing Issues & Improvement Plan

**Date:** October 17, 2025  
**Status:** Parsing needs significant improvement

---

## 📊 **Current Parsing Results (Weak)**

### **Success Rate by Entity Type**
| Entity | Detected | Total | Rate | Status |
|--------|----------|-------|------|--------|
| **Locations** | 0 | 9 | 0% | ❌ Critical |
| **People** | 1 | 9 | 11% | ❌ Very Weak |
| **Organizations** | 2 | 9 | 22% | ❌ Weak |
| **Schemes** | 1 | 9 | 11% | ❌ Very Weak |
| **Event Types** | 9 | 9 | 100% | ⚠️ Inaccurate |

### **Confidence Scores**
- **Average:** 0.42 (Below 0.7 threshold)
- **Range:** 0.34 - 0.59
- **All flagged for review:** Yes

---

## 🐛 **Specific Issues Found**

### **Tweet #1: Birthday Wishes**
```
Text: "अंतागढ़ विधानसभा के लोकप्रिय विधायक एवं छत्तीसगढ़ भाजपा के पूर्व अध्यक्ष 
माननीय श्री विक्रम उसेंडी जी को जन्मदिन की हार्दिक बधाई..."
```

**What We Got:**
- Event: `rally` ❌ (Should be `birthday_wishes`)
- Locations: None ❌ (Should detect: अंतागढ़, छत्तीसगढ़)
- People: `['VikramUsendi']` ⚠️ (Should also extract: पवन पटेल)
- Organizations: `['भाजपा']` ✅ (Correct!)

**What We Missed:**
- ❌ Location: "अंतागढ़"
- ❌ Location: "छत्तीसगढ़"
- ❌ Wrong event type

---

### **Tweet #4: Condolence Message**
```
Text: "चपले मंडल अध्यक्ष श्री पवन पटेल जी के पिताजी, भारतीय जनता पार्टी चपले मंडल 
के वरिष्ठ कार्यकर्ता श्री भरत लाल पटेल जी के निधन का समाचार..."
```

**What We Got:**
- Event: `inspection` ❌ (Should be `condolence`)
- Locations: None ❌ (Should detect: चपले)
- People: None ❌ (Should detect: पवन पटेल, भरत लाल पटेल)
- Organizations: None ❌ (Should detect: भारतीय जनता पार्टी)

**What We Missed:**
- ❌ Location: "चपले"
- ❌ Person: "पवन पटेल"
- ❌ Person: "भरत लाल पटेल"
- ❌ Organization: "भारतीय जनता पार्टी"
- ❌ Wrong event type

---

### **Tweet #5: Government Announcement**
```
Text: "छत्तीसगढ़ के विभिन्न निगम, मंडल, आयोग और बोर्ड के अध्यक्ष एवं उपाध्यक्ष को 
राज्य शासन द्वारा मंत्री एवं राज्यमंत्री का दर्जा प्रदान किया गया है..."
```

**What We Got:**
- Event: `inspection` ❌ (Should be `government_announcement`)
- Locations: None ❌ (Should detect: छत्तीसगढ़)
- People: None ❌
- Organizations: `['निगम']` ⚠️ (Partial, should also detect: मंडल, आयोग, बोर्ड, राज्य शासन)

**What We Missed:**
- ❌ Location: "छत्तीसगढ़"
- ❌ Organizations: "मंडल", "आयोग", "बोर्ड", "राज्य शासन"
- ❌ Wrong event type

---

## 🎯 **Root Causes**

### **1. Event Classification Issues**
- **Problem:** Generic "inspection" and "other" being overused
- **Examples:**
  - Birthday → classified as "rally"
  - Condolence → classified as "inspection"
  - Announcement → classified as "inspection"

### **2. Location Detection Failure**
- **Problem:** 0/9 tweets have locations
- **Reason:** Parser not extracting Hindi place names
- **Missing:**
  - अंतागढ़ (Antagarh)
  - छत्तीसगढ़ (Chhattisgarh)
  - चपले (Chaple)
  - भारत (India)

### **3. People Extraction Weak**
- **Problem:** Only catching Twitter handles, missing Hindi names
- **Examples Missed:**
  - पवन पटेल (Pawan Patel)
  - भरत लाल पटेल (Bharat Lal Patel)
  - विक्रम उसेंडी (Vikram Usendi - only got Twitter handle)

### **4. Organization Detection Partial**
- **Problem:** Missing multi-word organizations
- **Examples Missed:**
  - भारतीय जनता पार्टी (full name, only got "भाजपा")
  - राज्य शासन (State Government)
  - मंडल, आयोग, बोर्ड (Councils, Commissions, Boards)

---

## 🔧 **Required Improvements**

### **Priority 1: Event Classification**
Add proper event types:
- ✅ `birthday_wishes` - जन्मदिन
- ✅ `condolence` - निधन, शोक
- ✅ `government_announcement` - राज्य शासन, निर्णय
- ✅ `scheme_announcement` - योजना
- ✅ `rally` - रैली, सम्मेलन
- ✅ `inspection` - निरीक्षण
- ✅ `inauguration` - उद्घाटन, शिलान्यास
- ✅ `meeting` - बैठक, चर्चा

### **Priority 2: Location Extraction**
Add Chhattisgarh geography dataset:
- **Districts:** रायगढ़, बस्तर, दुर्ग, बिलासपुर, etc.
- **Cities:** रायपुर, भिलाई, कोरबा, etc.
- **Assembly Constituencies:** अंतागढ़, खुजी, खरसिया, etc.
- **Blocks:** चपले, धर्मजयगढ़, सारंगढ़, etc.
- **States:** छत्तीसगढ़, महाराष्ट्र, दिल्ली, etc.
- **Country:** भारत

### **Priority 3: People Name Extraction**
Improve Hindi name patterns:
- **Pattern:** श्री/श्रीमती + [Name] + जी
- **Examples:**
  - श्री पवन पटेल जी
  - माननीय श्री विक्रम उसेंडी जी
  - श्री भरत लाल पटेल जी
  - श्री नरेंद्र मोदी जी
  - श्री अमित शाह जी

### **Priority 4: Organization Extraction**
Add common organizations:
- **Political Parties:**
  - भारतीय जनता पार्टी (BJP)
  - भाजपा (BJP short form)
  - कांग्रेस (Congress)
  
- **Government Bodies:**
  - राज्य शासन (State Government)
  - केंद्र सरकार (Central Government)
  - निगम (Corporation)
  - मंडल (Council)
  - आयोग (Commission)
  - बोर्ड (Board)

---

## 📋 **Action Plan**

### **Immediate (Today)**
1. ✅ Fix metrics to show correct summary
2. ⏳ Create improved parser with better regex patterns
3. ⏳ Add Chhattisgarh geography dataset
4. ⏳ Reparse all 9 tweets with improved parser

### **Short-term (This Week)**
5. ⏳ Manual review and correction of 9 tweets
6. ⏳ Add scheme keywords dataset
7. ⏳ Improve confidence scoring algorithm
8. ⏳ Create human review workflow

### **Medium-term (Next Week)**
9. ⏳ Fetch remaining 91 tweets
10. ⏳ Apply for Elevated Access
11. ⏳ Fetch full historical dataset (~2000 tweets)
12. ⏳ Train custom NER model for Hindi

---

## 🎯 **Success Metrics**

### **Target After Improvement**
| Entity | Target | Current | Gap |
|--------|--------|---------|-----|
| **Locations** | >80% | 0% | +80% |
| **People** | >70% | 11% | +59% |
| **Organizations** | >70% | 22% | +48% |
| **Schemes** | >60% | 11% | +49% |
| **Event Types** | >85% | ~30% | +55% |
| **Confidence** | >0.7 | 0.42 | +0.28 |

---

## 📝 **Next Steps**

### **1. Create Enhanced Parser (URGENT)**
```python
# Enhanced patterns needed:
- Location regex for Hindi place names
- People name patterns (श्री [NAME] जी)
- Organization multi-word matching
- Event type keyword matching
- Scheme name detection
```

### **2. Build Geography Dataset**
```json
{
  "states": ["छत्तीसगढ़", "महाराष्ट्र", "मध्य प्रदेश"],
  "districts": ["रायगढ़", "बस्तर", "दुर्ग"],
  "cities": ["रायपुर", "भिलाई", "कोरबा"],
  "constituencies": ["अंतागढ़", "खुजी", "खरसिया"]
}
```

### **3. Test & Validate**
- Reparse 9 tweets
- Check accuracy manually
- Adjust patterns
- Iterate

---

**Status:** Metrics fixed ✅, Parser improvement in progress ⏳

*Last Updated: October 17, 2025*

