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
