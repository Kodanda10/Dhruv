<!-- 9d1a70d9-8ecb-4a47-aa8d-2e99adcc88a1 bb56db0e-84b0-4768-b6bc-d46c8ba503df -->
# LangGraph AI Assistant Implementation with Real Data

## Architecture Decision: Agent-Based LangGraph

Based on requirements for natural language parsing, data validation, and multi-turn conversations, we'll use **Agent-Based LangGraph** with:

- State machine nodes for conversation flow
- Tools for specific actions (add_location, suggest_event, validate_consistency)
- Memory for conversation context
- Parallel model execution for testing/comparison

## Phase 1: Core LangGraph Infrastructure

### 1.1 Install Dependencies

```bash
npm install langchain @langchain/core @langchain/community langgraph @langchain/google-genai
```

### 1.2 Create LangGraph AI Assistant Core (`src/lib/ai-assistant/langgraph-assistant.ts`)

- Define state schema with conversation history, current tweet data, pending changes
- Create agent nodes: analyze_tweet, generate_suggestions, parse_user_request, apply_changes, validate_consistency
- Implement tools: addLocation, suggestEventType, addScheme, generateHashtags, validateData
- Connect to Gemini (primary) and Ollama (fallback)
- Add parallel execution mode for model comparison

### 1.3 Create Tool Definitions (`src/lib/ai-assistant/tools.ts`)

- `addLocation`: Parse and add location with validation against geography data
- `suggestEventType`: Suggest event types from learned data (ref_event_types)
- `addScheme`: Add scheme with validation against ref_schemes
- `generateHashtags`: Generate contextual hashtags using hashtag generation engine
- `validateConsistency`: Check scheme-event type compatibility, location validity

### 1.4 Create Model Manager (`src/lib/ai-assistant/model-manager.ts`)

- GeminiModelProvider: Uses Gemini 1.5 Flash with free tier limits
- OllamaModelProvider: Uses gemma2:2b local model
- ModelOrchestrator: Handles primary/fallback logic, parallel execution
- Rate limiting and error handling

## Phase 2: Conversational Intelligence

### 2.1 Natural Language Parser (`src/lib/ai-assistant/nl-parser.ts`)

- Parse Hindi/English mixed requests: "add रायपुर as location", "change event to बैठक"
- Extract intent, entities, and actions from user messages
- Support complex requests: "add 3 schemes: PM Kisan, Ayushman Bharat, Ujjwala"

### 2.2 Context Manager (`src/lib/ai-assistant/context-manager.ts`)

- Maintain conversation state across turns
- Track what user has edited, what's pending, what's approved
- Provide relevant context to LLM based on conversation stage

### 2.3 Suggestion Engine (`src/lib/ai-assistant/suggestion-engine.ts`)

- Query DynamicLearningSystem for learned patterns
- Generate contextual suggestions based on tweet content
- Rank suggestions by relevance and usage count

## Phase 3: API Integration

### 3.1 Update AI Assistant API (`src/app/api/ai-assistant/route.ts`)

- Replace mock responses with LangGraph agent
- Support streaming responses for real-time feedback
- Handle conversation context persistence
- Implement model comparison mode

### 3.2 Create dedicated endpoints:

- `POST /api/ai-assistant/suggest` - Auto-suggestions on edit
- `POST /api/ai-assistant/chat` - Conversational interaction
- `POST /api/ai-assistant/validate` - Data consistency validation
- `POST /api/ai-assistant/compare` - Compare Gemini vs Ollama results

## Phase 4: Frontend Integration

### 4.1 Update AIAssistantModal (`src/components/review/AIAssistantModal.tsx`)

- Add streaming message support
- Show model being used (Gemini/Ollama)
- Display automated suggestions on modal open
- Add quick action buttons for common tasks
- Show validation warnings/errors

### 4.2 Update ReviewQueueNew (`src/components/review/ReviewQueueNew.tsx`)

- Trigger auto-suggestions when entering edit mode
- Apply AI-suggested changes with one click
- Show AI confidence scores for suggestions

## Phase 5: Comprehensive Testing (100+ tests with Real Data)

### 5.1 Unit Tests (`tests/lib/ai-assistant/`)

**langgraph-assistant.test.ts** (20 tests):

- State transitions between nodes
- Tool execution with real tweet data
- Error handling and fallback
- Conversation flow management

**nl-parser.test.ts** (25 tests):

- Parse Hindi/English mixed requests using real tweet examples
- Extract locations: "add रायगढ़, बिलासपुर as locations"
- Extract event types: "change to बैठक meeting"
- Extract schemes: "add PM Kisan scheme"
- Handle malformed requests
- Test all 68 tweets for parsing capabilities

**model-manager.test.ts** (15 tests):

- Gemini API integration with rate limiting
- Ollama local model fallback
- Parallel execution and comparison
- Error recovery

**tools.test.ts** (20 tests):

- addLocation with geography validation (test against CG_Geo data)
- suggestEventType from ref_event_types table
- addScheme validation against ref_schemes
- generateHashtags using real scheme/location data
- validateConsistency with real tweet combinations

### 5.2 Integration Tests (`tests/integration/ai-assistant/`)

**complete-workflow.test.ts** (30 tests):

- Full conversation flow using real tweets from database
- User: "add रायपुर location" → AI: adds + validates → User: "also add scheme" → AI: suggests from learned data
- Multi-turn conversations with context
- Test all 68 tweets through complete workflow
- Model fallback scenarios
- Parallel model comparison

**suggestion-engine.test.ts** (15 tests):

- Generate suggestions from learned data for each of 68 tweets
- Rank suggestions by relevance
- Context-aware suggestions based on existing parsed data

**validation.test.ts** (10 tests):

- Validate scheme-event compatibility using real data
- Check location existence in geography data
- Verify hashtag generation against patterns

### 5.3 End-to-End Tests (`tests/e2e/ai-assistant/`)

**user-scenarios.test.ts** (15 tests using real tweets):

- Scenario 1: Edit tweet with no parsed data → AI suggests all fields
- Scenario 2: Refine existing parsed data → AI validates + suggests improvements
- Scenario 3: Add multiple entities in one message
- Scenario 4: Correct AI suggestions → AI learns from correction
- Scenario 5: Complex multi-turn dialogue for single tweet
- Test with random sample of 15 tweets from 68

## Phase 6: Model Comparison & Deployment Strategy

### 6.1 Create Comparison Framework (`src/lib/ai-assistant/model-comparison.ts`)

- Run both Gemini and Ollama on same request
- Compare: accuracy, response time, suggestion quality
- Log comparison results for analysis
- Generate comparison report

### 6.2 Deployment Decision Logic

- If Gemini accuracy > 90% and response time < 2s: Use Gemini primary
- If Ollama accuracy > 85% and Gemini unreliable: Use Ollama primary
- If both perform well: Use Gemini (free tier) with Ollama fallback
- Add admin dashboard to view comparison metrics

### 6.3 Create Performance Monitor (`src/lib/ai-assistant/performance-monitor.ts`)

- Track success rates for both models
- Monitor API quota usage (Gemini free tier)
- Auto-switch to Ollama if quota exceeded
- Alert on model degradation

## Phase 7: Memory Updates

### 7.1 Update Memory to Use Real Data

- Replace all mock tweet IDs with actual IDs from database (1979074268907606480, etc.)
- Store real examples of successful AI interactions
- Document real tweet patterns for future reference
- Create memory entry for AI Assistant architecture decisions

## Implementation Order

1. Install dependencies + LangGraph core (1-2 hours)
2. Create tools and model manager (2-3 hours)
3. Build NL parser and context manager (2-3 hours)
4. Update API routes (1-2 hours)
5. Frontend integration (2-3 hours)
6. Unit tests with real data (3-4 hours)
7. Integration tests (3-4 hours)
8. E2E tests (2-3 hours)
9. Model comparison framework (2-3 hours)
10. Performance monitoring (1-2 hours)

**Total Estimated Time: 20-30 hours**

## Success Criteria

- 100+ tests passing with real data from 68 tweets
- AI Assistant responds in < 3 seconds (Gemini) or < 1 second (Ollama)
- Suggestion accuracy > 85% validated against human corrections
- Natural language parsing success rate > 90% for common requests
- Model fallback triggers seamlessly on Gemini failures
- All 68 tweets successfully processed through AI assistant workflow

### To-dos

- [ ] Install LangGraph dependencies and create core agent infrastructure
- [ ] Implement AI Assistant tools (addLocation, suggestEventType, etc.)
- [ ] Create model manager with Gemini/Ollama support
- [ ] Build natural language parser for Hindi/English mixed requests
- [ ] Implement conversation context manager
- [ ] Update AI Assistant API with LangGraph agent
- [ ] Enhance AIAssistantModal with streaming and auto-suggestions
- [ ] Write 80+ unit tests using real data from 68 tweets
- [ ] Write 30+ integration tests for complete workflows
- [ ] Write 15+ E2E tests with real tweet scenarios
- [ ] Implement model comparison framework
- [ ] Add performance monitoring and auto-fallback
- [ ] Update memory with real tweet IDs and AI patterns