# 🚀 COMPREHENSIVE TESTING PLAN: 1500+ Scenarios with Real Tweet Data

## 📊 **TEST DATA SOURCES**

### **Primary Data Sources:**
1. **Database Tweets**: 2571 raw tweets from @OPChoudhary_Ind
2. **RTF File**: 2504 tweets with full metadata
3. **Parsed Events**: 2325 existing parsed results for baseline comparison

### **Data Categories Identified:**
- **Political Events**: Rallies, meetings, inaugurations
- **Development Work**: Infrastructure, schemes, inspections
- **Social Issues**: Relief work, health camps, education
- **Cultural Events**: Festivals, ceremonies, tributes
- **Administrative**: Official visits, policy announcements

---

## 🧪 **TEST SCENARIOS BREAKDOWN (1500+ Tests)**

### **1. EVENT TYPE CLASSIFICATION (500 Scenarios)**

#### **1.1 Inauguration Events (100 tests)**
```sql
-- Sample real tweets for inauguration testing
SELECT text FROM raw_tweets WHERE text ILIKE '%उद्घाटन%' OR text ILIKE '%लोकार्पण%' LIMIT 50;
SELECT text FROM raw_tweets WHERE text ILIKE '%शिलान्यास%' OR text ILIKE '%भूमिपूजन%' LIMIT 50;
```

**Expected Patterns:**
- "स्वास्थ्य शिविर का उद्घाटन" → inauguration, high confidence
- "अस्पताल का लोकार्पण" → inauguration, high confidence
- "परियोजना का शिलान्यास" → inauguration, high confidence

#### **1.2 Meeting Events (100 tests)**
```sql
SELECT text FROM raw_tweets WHERE text ILIKE '%बैठक%' OR text ILIKE '%मुलाकात%' LIMIT 50;
SELECT text FROM raw_tweets WHERE text ILIKE '%सम्मेलन%' OR text ILIKE '%चर्चा%' LIMIT 50;
```

**Expected Patterns:**
- "कैबिनेट बैठक संपन्न" → meeting, high confidence
- "मंत्री मंडल की बैठक" → meeting, high confidence
- "प्रशासनिक समीक्षा बैठक" → meeting, medium confidence

#### **1.3 Rally & Public Events (100 tests)**
```sql
SELECT text FROM raw_tweets WHERE text ILIKE '%रैली%' OR text ILIKE '%सभा%' LIMIT 50;
SELECT text FROM raw_tweets WHERE text ILIKE '%जुलूस%' OR text ILIKE '%आंदोलन%' LIMIT 50;
```

**Expected Patterns:**
- "जनसभा का आयोजन" → rally, high confidence
- "किसान रैली में पहुंचे" → rally, high confidence

#### **1.4 Inspection & Administrative (100 tests)**
```sql
SELECT text FROM raw_tweets WHERE text ILIKE '%निरीक्षण%' OR text ILIKE '%दौरा%' LIMIT 50;
SELECT text FROM raw_tweets WHERE text ILIKE '%समीक्षा%' OR text ILIKE '%आगाज%' LIMIT 50;
```

**Expected Patterns:**
- "विकास कार्यों का निरीक्षण" → inspection, high confidence
- "परियोजनाओं की समीक्षा" → inspection, high confidence

#### **1.5 Scheme Announcements (100 tests)**
```sql
SELECT text FROM raw_tweets WHERE text ILIKE '%योजना%' OR text ILIKE '%घोषणा%' LIMIT 50;
SELECT text FROM raw_tweets WHERE text ILIKE '%विस्तार%' OR text ILIKE '%प्रारंभ%' LIMIT 50;
```

**Expected Patterns:**
- "मनरेगा योजना का विस्तार" → scheme_announcement, high confidence
- "किसान सम्मान निधि वितरण" → scheme_announcement, high confidence

### **2. ENTITY EXTRACTION (600 Scenarios)**

#### **2.1 Location Extraction (200 tests)**
**Test Cities/Districts:**
- रायपुर, बिलासपुर, रायगढ़, दुर्ग, राजनांदगांव
- छत्तीसगढ़, भारत, दिल्ली, मुंबई

**Expected Extractions:**
```javascript
"रायपुर में विकास कार्य" → ["रायपुर"]
"दिल्ली और मुंबई में बैठक" → ["दिल्ली", "मुंबई"]
"छत्तीसगढ़ राज्य में योजना" → ["छत्तीसगढ़"]
```

#### **2.2 People Name Extraction (200 tests)**
**Test Politicians:**
- @narendramodi, @AmitShah, @bhupeshbaghel
- मुख्यमंत्री, प्रधानमंत्री, मंत्री

**Expected Extractions:**
```javascript
"@narendramodi जी से मुलाकात" → ["narendramodi"]
"प्रधानमंत्री मोदी के साथ बैठक" → ["नरेंद्र मोदी"]
```

#### **2.3 Organization Extraction (100 tests)**
**Test Organizations:**
- भाजपा, कांग्रेस, सरकार, प्रशासन
- मंत्रालय, विभाग, निगम

**Expected Extractions:**
```javascript
"भाजपा की रैली में पहुंचे" → ["भाजपा"]
"राज्य सरकार की बैठक" → ["राज्य सरकार"]
```

#### **2.4 Scheme Name Extraction (100 tests)**
**Test Schemes:**
- मनरेगा, आयुष्मान भारत, स्वच्छ भारत
- प्रधानमंत्री आवास, किसान सम्मान

**Expected Extractions:**
```javascript
"मनरेगा के तहत रोजगार" → ["मनरेगा"]
"आयुष्मान भारत योजना" → ["आयुष्मान भारत"]
```

### **3. CONSENSUS VOTING (200 Scenarios)**

#### **3.1 Perfect Agreement (2/3 consensus)**
- Gemini + Ollama + Regex all agree
- Expected: High confidence, auto-approve

#### **3.2 Majority Agreement (2/3 consensus)**
- Two layers agree, one disagrees
- Expected: Medium confidence, possible review

#### **3.3 Disagreement (1/3 consensus)**
- All layers disagree
- Expected: Low confidence, needs review

#### **3.4 Layer Failure Scenarios**
- Gemini fails, Ollama + Regex agree
- Ollama fails, Gemini + Regex agree
- Regex fallback only

### **4. ERROR HANDLING & EDGE CASES (200 Scenarios)**

#### **4.1 Invalid Input Handling**
- Empty tweets, null values
- Extremely short/long content
- Non-Hindi content

#### **4.2 API Failure Scenarios**
- Gemini quota exceeded
- Ollama service unavailable
- Network timeouts

#### **4.3 Encoding & Unicode Issues**
- Mixed Devanagari + English
- Special characters and emojis
- URL and hashtag handling

---

## ⚡ **RATE LIMITING STRATEGY**

### **Gemini API (Free Tier: 5 RPM Max)**
```
Test Execution Timeline:
Phase 1 (0-5min):   150 tests - Gemini active
Phase 2 (5-10min):  300 tests - Rate limited, Ollama + Regex only
Phase 3 (10-15min): 450 tests - Rate limited, Ollama + Regex only
Phase 4 (15-20min): 300 tests - Rate limited, Ollama + Regex only
Phase 5 (20-25min): 300 tests - Rate limited, Ollama + Regex only

Total: 1500 tests in 25 minutes
Gemini Usage: ~150 requests (well under 300 free tier limit)
```

### **Test Execution Architecture:**
```typescript
// Rate-aware test runner
class RateLimitedTestRunner {
  private geminiUsed = 0;
  private readonly GEMINI_MAX = 5; // requests per minute

  async runTest(testCase: TestCase): Promise<TestResult> {
    const canUseGemini = this.geminiUsed < this.GEMINI_MAX;

    if (canUseGemini) {
      // Run all 3 layers
      this.geminiUsed++;
      return await this.runFullConsensus(testCase);
    } else {
      // Run Ollama + Regex only
      return await this.runPartialConsensus(testCase);
    }
  }
}
```

---

## 🔬 **TEST IMPLEMENTATION PLAN**

### **Phase 1: Data Preparation (Day 1)**
1. **Extract Test Dataset**
   ```sql
   -- Create test dataset from real tweets
   CREATE TABLE test_tweets AS
   SELECT id, tweet_id, text, created_at
   FROM raw_tweets
   WHERE text IS NOT NULL
     AND LENGTH(text) > 20
     AND author_handle = 'OPChoudhary_Ind'
   ORDER BY RANDOM()
   LIMIT 2000;
   ```

2. **Categorize Test Cases**
   - Manual labeling of 200 tweets for baseline
   - Automated categorization for remaining 1800
   - Edge case identification

### **Phase 2: Test Framework Development (Day 2-3)**
1. **Rate-Limited Test Runner**
   ```typescript
   // tests/lib/rate-limited-test-runner.ts
   export class RateLimitedTestRunner {
     // Implementation with Gemini rate limiting
   }
   ```

2. **Test Case Generator**
   ```typescript
   // tests/lib/test-case-generator.ts
   export class TestCaseGenerator {
     // Generate 1500+ scenarios from real data
   }
   ```

3. **Result Validator**
   ```typescript
   // tests/lib/result-validator.ts
   export class ResultValidator {
     // Validate parsing accuracy against expectations
   }
   ```

### **Phase 3: Comprehensive Testing (Day 4-5)**

#### **3.1 Accuracy Testing (800 tests)**
```typescript
describe('Parsing Accuracy - Real Data', () => {
  test.each(realTweetData)('parses real tweet correctly', async (tweet) => {
    const result = await parseTweet(tweet);
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.event_type).toBeDefined();
  });
});
```

#### **3.2 Consensus Testing (300 tests)**
```typescript
describe('Consensus Voting', () => {
  test('achieves 3/3 consensus for clear cases', async () => {
    const result = await parseClearTweet();
    expect(result.consensus_score).toBe(3);
    expect(result.needs_review).toBe(false);
  });
});
```

#### **3.3 Resilience Testing (200 tests)**
```typescript
describe('Error Resilience', () => {
  test('handles API failures gracefully', async () => {
    mockGeminiFailure();
    const result = await parseTweet(tweet);
    expect(result).toBeDefined(); // Should fallback
  });
});
```

#### **3.4 Performance Testing (200 tests)**
```typescript
describe('Performance Benchmarks', () => {
  test('parses within 3 seconds', async () => {
    const start = Date.now();
    await parseTweet(tweet);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);
  });
});
```

### **Phase 4: Integration Testing (Day 6)**

#### **4.1 End-to-End Pipeline**
```typescript
describe('End-to-End Pipeline', () => {
  test('fetch → parse → review → analytics', async () => {
    // 1. Fetch new tweets
    await fetchNewTweets();

    // 2. Parse with three-layer consensus
    const parsed = await parseAllTweets();

    // 3. Review low-confidence results
    const reviewed = await reviewLowConfidence(parsed);

    // 4. Analytics includes only approved
    const analytics = await generateAnalytics();
    expect(analytics.total).toBe(reviewed.approved.length);
  });
});
```

#### **4.2 Data Flow Validation**
```typescript
describe('Data Flow Integrity', () => {
  test('parsed events match raw tweets', async () => {
    const rawCount = await getRawTweetCount();
    const parsedCount = await getParsedEventCount();
    expect(parsedCount).toBeGreaterThan(rawCount * 0.8); // 80% success rate
  });

  test('review queue shows low confidence', async () => {
    const reviewQueue = await getReviewQueue();
    reviewQueue.forEach(item => {
      expect(item.confidence).toBeLessThan(0.7);
    });
  });
});
```

---

## 📈 **SUCCESS METRICS**

### **Accuracy Targets:**
- **Event Classification**: >85% accuracy vs manual labeling
- **Entity Extraction**: >90% precision, >80% recall
- **Consensus Agreement**: >75% cases achieve 2/3 agreement

### **Performance Targets:**
- **Response Time**: <3 seconds per tweet average
- **Success Rate**: >95% tweets parsed successfully
- **Review Efficiency**: <25% tweets require human review

### **Rate Limiting Compliance:**
- **Gemini Usage**: <50% of free tier limit (150/300 requests)
- **Cost Control**: Zero unexpected API charges
- **Fallback Reliability**: 100% functionality without AI

---

## 🛠️ **IMPLEMENTATION PRIORITY**

### **Week 1: Foundation**
1. ✅ Rate limiter implementation
2. ✅ Test data extraction from RTF/database
3. ✅ Basic test framework setup

### **Week 2: Core Testing**
4. 🔄 Event classification tests (500 scenarios)
5. 🔄 Entity extraction tests (600 scenarios)
6. 🔄 Consensus voting tests (200 scenarios)

### **Week 3: Advanced Testing**
7. 🔄 Error handling tests (200 scenarios)
8. 🔄 Performance benchmarking
9. 🔄 Integration pipeline testing

### **Week 4: Validation & Optimization**
10. 🔄 End-to-end pipeline validation
11. 🔄 Accuracy optimization
12. 🔄 Production readiness assessment

---

## 🎯 **DELIVERABLES**

1. **Test Suite**: 1500+ automated test cases
2. **Performance Report**: Response times, accuracy metrics
3. **Coverage Report**: Code coverage >85%
4. **Integration Report**: Pipeline validation results
5. **Production Assessment**: Go/no-go recommendation

**This comprehensive testing plan ensures the three-layer consensus parsing system is thoroughly validated with real-world data while maintaining strict compliance with API rate limits and free tier usage.**
