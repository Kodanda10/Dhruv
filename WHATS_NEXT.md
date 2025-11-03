# What's Next — Project Dhruv

**Updated:** October 17, 2025  
**Status:** Twitter integration complete ✅ | Ready for parsing pipeline

---

## 🎉 What We Just Accomplished

✅ **Twitter API Integration**
- Fixed monthly quota issue (switched to fresh project)
- Verified token without wasting quota
- Fetched 9 sample tweets
- Stored in PostgreSQL database
- Complete pipeline validated

✅ **Technical Debt Cleanup**
- Removed Neo4j (over-engineered for MVP)
- Removed Milvus SOTA brain (over-engineered for MVP)
- Archived unnecessary complexity
- Focused on core MVP objectives

---

## 🚀 Immediate Next Steps (Today/Tomorrow)

### 1. Test Parsing Pipeline with Real Tweets ⚡

**What:** Run the existing parsing pipeline on the 9 fetched tweets

**Why:** Verify the parsing works with real OP Choudhary tweets (Hindi/Hinglish mix)

**Commands:**
```bash
cd /Users/abhijita/Projects/Project_Dhruv
source .venv/bin/activate
python scripts/parse_tweets.py
```

**Expected Output:**
- Extract What/When/Where/Who from each tweet
- Store in `parsed_events` table
- Generate confidence scores
- Flag items needing human review

---

### 2. Build Human Review Interface 🔍

**What:** Create a simple UI to review parsed results

**Features needed:**
- Show original tweet
- Show parsed data (event type, date, location, etc.)
- Confidence scores
- Approve/Edit/Reject buttons
- Mark as reviewed

**Location:** `src/components/HumanReviewDashboard.tsx` (already exists, needs updating)

---

### 3. Create Basic Analytics Dashboard 📊

**What:** Visualize the parsed data

**Components:**
1. **Location Map**
   - Interactive map showing visited places
   - Frequency heatmap for Raigarh constituency
   - Other locations in Chhattisgarh and beyond

2. **Event Types Chart**
   - Bar chart: inaugurations, rallies, meetings, etc.
   - Pie chart: distribution of event types

3. **Timeline View**
   - Activity over time
   - Date coverage
   - Frequency patterns

4. **Schemes Tracker**
   - Government schemes mentioned
   - Category breakdown
   - Announcement patterns

---

## 📋 This Week's Goals

### Priority 1: Get Parsing Working (Day 1-2)
- [~] Run parsing on 9 tweets
- [ ] Verify extraction accuracy
- [ ] Test confidence scoring
- [ ] Identify parsing gaps

### Priority 2: Human Review (Day 2-3)
- [ ] Update review dashboard
- [ ] Test review workflow
- [ ] Validate corrections work
- [ ] Export reviewed data

### Priority 3: Basic Visualizations (Day 3-4)
- [ ] Build location map component
- [ ] Add event type charts
- [ ] Create timeline view
- [ ] Show basic metrics

### Priority 4: Data Quality (Day 4-5)
- [ ] Review parsing accuracy
- [ ] Tune confidence thresholds
- [ ] Fix common errors
- [ ] Document edge cases

---

## 🎯 Next Sprint Goals (Week 2)

### Fetch More Tweets
- **Strategy:** Fetch remaining 91 tweets in batches
- **Timing:** Respect 15-minute rate limits
- **Goal:** Get 100 total tweets for better testing

### Enhance Parsing
- **Location matching:** Against geography dataset
- **Scheme detection:** Match against schemes dataset
- **Festival detection:** Against festival dataset
- **Date extraction:** Improve accuracy

### Dashboard Polish
- **Filters:** By date, location, event type
- **Search:** Find specific tweets/events
- **Export:** Download parsed data
- **Metrics:** Coverage, accuracy stats

---

## 🔮 Future Plans (After Current Sprint)

### Apply for Elevated Access
- **What:** Twitter API elevated tier
- **Benefit:** 10,000 tweets/month (vs 100)
- **Timeline:** 1-2 day approval
- **Use:** Fetch full historical dataset (~2000 tweets)

### Complete Historical Fetch
- **Scope:** December 2013 to October 2025
- **Volume:** ~2000 tweets
- **Processing:** Parse all historical data
- **Output:** Complete activity database

### Advanced Analytics
- **Constituency Coverage:** Deep dive into Raigarh
- **Comparison:** Raigarh vs rest of Chhattisgarh
- **Trends:** Activity patterns over time
- **Impact:** Event types vs engagement

### Production Deployment
- **Platform:** Vercel (already configured)
- **Features:** Full dashboard with all data
- **Access:** Client-ready interface
- **Monitoring:** Usage and performance tracking

---

## 🛠️ Technical Notes

### Current Stack
- ✅ Next.js frontend (dashboard)
- ✅ Flask API (parsing backend)
- ✅ PostgreSQL (data storage)
- ✅ Docker Compose (local dev)
- ✅ Twitter API v2 (data source)

### Active Scripts
- `verify_new_token.py` - Check token validity
- `fetch_10_tweets.py` - Fetch small batches
- `check_tweets.py` - Query database
- `scripts/parse_tweets.py` - Run parsing pipeline
- `scripts/run_migrations.py` - Update database schema

### Key Files
- `.env.local` - API keys and secrets
- `infra/docker-compose.yml` - Database setup
- `api/src/twitter/client.py` - Twitter integration
- `api/src/parsing/orchestrator.py` - Parsing pipeline

---

## 📊 Success Metrics

### This Week
- [ ] Parsing accuracy > 70% (with human review)
- [ ] All 9 tweets processed and reviewed
- [ ] Basic dashboard showing location map
- [ ] Event type distribution chart working

### Next Week
- [ ] 100 tweets fetched and parsed
- [ ] Human review interface complete
- [ ] All dashboard components working
- [ ] Export functionality ready

### End of Month
- [ ] Elevated access approved
- [ ] 500+ tweets in database
- [ ] Parsing accuracy > 80%
- [ ] Client demo ready

---

## 🚨 Important Reminders

### Twitter API Limits
- **100 tweets/month** until elevated access
- **91 tweets remaining** this month
- **3 requests per 15 minutes** for tweet endpoints
- **Resets November 13, 2025**

### Development Approach
- ✅ **TDD:** Write tests first
- ✅ **Atomic commits:** Small, focused changes
- ✅ **CI/CD:** All checks must pass
- ✅ **Documentation:** Update as you go

### Don't Forget
- 🔐 Never commit API keys
- 📝 Update TODO list regularly
- 🧪 Test before pushing
- 📊 Monitor database growth

---

## 📞 Need Help?

### Debugging
- Check logs: `/logs/` directory
- Database: `python check_tweets.py`
- API status: `python verify_new_token.py`
- CI status: GitHub Actions tab

### Resources
- Twitter API docs: https://developer.twitter.com/en/docs/twitter-api
- PostgreSQL docs: https://www.postgresql.org/docs/
- Next.js docs: https://nextjs.org/docs
- Flask docs: https://flask.palletsprojects.com/

---

## ✨ The Big Picture

**Goal:** Build a comprehensive social media analytics platform for OP Choudhary

**Current Status:** 
- ✅ Data ingestion working
- 🔄 Parsing pipeline ready to test
- 📊 Dashboard structure in place
- 🎯 MVP scope defined

**Timeline:**
- **This week:** Get 100 tweets, test parsing
- **Next week:** Polish dashboard, human review
- **Month 2:** Full historical dataset, production ready

---

**Let's build something great! 🚀**

*Last Updated: October 17, 2025*

