# Learnings - openrouter-scraper

## Conventions & Patterns

(Subagents will append findings here)
# OpenRouter Scraper - Learnings

## Project Setup (Task 1)

### Bun Initialization
- `bun init -y` creates a minimal project with:
  - `package.json` with basic metadata
  - `tsconfig.json` for TypeScript support
  - `bun.lockb` lockfile
  - `.gitignore` and README.md
  - Automatically installs `@types/bun` and `typescript`

### Test Infrastructure
- Bun's built-in test runner (`bun test`) works out of the box
- Tests are discovered from `**/*.test.ts` and `**/*.test.tsx` patterns
- No additional test framework needed - `bun:test` module provides `test()` and `expect()`
- Sample test passes immediately after creation

### Playwright Integration
- `bun add playwright` installs v1.58.1
- Playwright is available for browser automation tasks
- No additional configuration needed for basic usage

### Directory Structure
- Created `src/lib/` for library modules
- Created `src/__tests__/` for test files
- Sample test file: `src/__tests__/sample.test.ts`

### Key Observations
1. Bun's package manager is fast and efficient
2. TypeScript is pre-configured and works seamlessly
3. Test infrastructure is minimal but complete
4. No need for additional build tools or bundlers at this stage

## Task 2: OpenRouter API Client Implementation

### API Response Structure
- OpenRouter API endpoint: `https://openrouter.ai/api/v1/models`
- Response format: `{ data: Model[] }`
- No authentication required for public models endpoint
- Total models available: 347 (as of test run)
- Open-weight models: 194 (56% of total)

### Open-Weight Filtering Logic
- Filter criterion: `model.hugging_face_id && model.hugging_face_id !== ""`
- Empty string `""` indicates closed-source model
- Non-empty `hugging_face_id` indicates open-weight model (e.g., "deepseek-ai/DeepSeek-V3")

### Pricing Edge Cases
- Pricing value "-1" indicates dynamic/router pricing
- Most models have fixed pricing (e.g., "0.30" = $0.30 per 1M tokens)
- Both prompt and completion pricing can be dynamic

### Retry Logic Implementation
- Simple exponential backoff: `RETRY_DELAY_MS * attempt`
- Max 3 attempts before throwing error
- Bun's native `fetch` handles network errors gracefully

### TDD Workflow Success
- RED phase: Comprehensive test coverage including edge cases
- GREEN phase: Minimal implementation to pass tests
- REFACTOR phase: Clean type definitions and simple retry logic
- All 7 tests passed on first run

### Bun-Specific Patterns
- Native `fetch` API works out of the box (no node-fetch needed)
- `bun:test` framework similar to Jest/Vitest
- TypeScript strict mode enforced by default

## HuggingFace API Client Implementation (Task 3)

### API Response Structure
- **License location**: NOT in `license` field, but in `tags` array
- **Format**: `license:<license-name>` (e.g., `license:mit`, `license:llama2`)
- **Extraction**: Use `tags.find(tag => tag.startsWith("license:"))` then strip prefix

### License Classification
- **Fully Open**: apache-2.0, mit, bsd-3-clause, cc-by-4.0
- **Open with Restrictions**: llama2, llama3, gemma, cc-by-nc-4.0
- **Unknown**: Missing tags, no license tag, or unrecognized license

### Rate Limiting
- Implemented 500ms delay between requests using module-level `lastRequestTime` tracker
- Pattern: Check elapsed time, sleep if needed, update timestamp

### Error Handling
- API errors (non-200 status) → return "Unknown"
- Missing tags array → return "Unknown"
- Network errors (catch block) → return "Unknown"
- Graceful degradation: never throw, always return valid LicenseCategory

### Testing Insights
- Real API calls in tests work well with Bun's fast runtime
- Some models (e.g., DeepSeek-V3) have no license tags → correctly return "Unknown"
- Model redirects (bert-base-uncased → google-bert/bert-base-uncased) handled by curl -L

### TDD Workflow Success
1. RED: Wrote 8 tests first (all failed initially)
2. GREEN: Implemented API client with correct tag parsing
3. REFACTOR: Error handling already clean, no changes needed
4. All tests pass in ~3.8s

