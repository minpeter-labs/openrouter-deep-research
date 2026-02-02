# OpenRouter Open-Weight Model Report Generator

## TL;DR

> **Quick Summary**: Friendliai 서버리스에 올릴 모델 선정을 위해 OpenRouter.ai에서 오픈웨이트 모델 사용 데이터를 수집하고 마크다운 리포트를 자동 생성하는 CLI 도구 개발
> 
> **Deliverables**:
> - `src/index.ts` - 메인 스크래핑/리포트 생성 CLI
> - `src/lib/*.ts` - 핵심 로직 모듈 (API, 스크래핑, 리포트 생성)
> - `src/__tests__/*.test.ts` - TDD 테스트 파일들
> - `report.md` - 생성된 마크다운 리포트
> 
> **Estimated Effort**: Large (2단계 접근, TDD 포함)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request
Friendliai라는 AI 제공 업체를 운영하고 있으며, 서버리스에 어떤 모델을 올려야 가장 효과적일지 마케팅 부서에 알리기 위해 OpenRouter.ai에서 유저들이 실제로 사용하는 오픈웨이트 모델 정보를 스크레핑하고 정리해서 리포트를 만들어주는 자동화 코드 개발

### Interview Summary
**Key Discussions**:
- 오픈웨이트 범위: 서빙 가능한 모든 모델, 라이선스 분류 포함
- 기술 스택: Bun + TypeScript + Playwright
- 데이터 범위: 인기도/사용량 + 카테고리별 분석 + 가격 + 성능 스펙 + Apps 사용 정보
- 출력 형식: 마크다운 리포트
- 테스트: TDD 방식
- 개발 접근: 2단계 (Phase 1: API → Phase 2: Rankings + 상세 페이지)
- 스크래핑 범위: 오픈웨이트 모델만 (~193개)
- 라이선스: HuggingFace API 조회 허용

**Research Findings**:
- `/api/v1/models` API: 공개, 인증 불필요, 346개 모델
- `/rankings` 페이지: API 없음, Playwright 스크래핑 필요
- 오픈웨이트 판별: `hugging_face_id` 필드 존재 여부
- 모델 상세 페이지: Apps/Performance/Activity 탭 존재

### Metis Review
**Identified Gaps** (addressed):
- 스크래핑 범위: 오픈웨이트 모델만으로 결정 (193개)
- 2단계 접근: Phase 1 MVP → Phase 2 Full로 결정
- 라이선스 정보: HuggingFace API 조회 허용으로 결정
- 가드레일: 과도한 추상화 방지, 단순 구조 유지

---

## Work Objectives

### Core Objective
OpenRouter API와 웹 스크래핑을 통해 오픈웨이트 모델 데이터를 수집하고, Friendliai 마케팅팀이 활용할 수 있는 마크다운 리포트를 자동 생성하는 CLI 도구 개발

### Concrete Deliverables
- `bun run scrape` 실행 시 `report.md` 파일 생성
- 리포트 내용:
  - 오픈웨이트 모델 목록 (100개 이상)
  - 주간 사용량 순위
  - 가격 비교 테이블
  - 라이선스 분류
  - 성능 스펙 (context length, modality)
  - 카테고리별 인기 모델
  - 어떤 앱이 어떤 모델을 사용하는지

### Definition of Done
- [ ] `bun run scrape` 실행 시 `report.md` 생성 (exit code 0)
- [ ] 리포트에 100개 이상 오픈웨이트 모델 포함
- [ ] 모든 테스트 통과 (`bun test`)
- [ ] 전체 실행 시간 20분 이내

### Must Have
- OpenRouter API 데이터 수집 (모델 메타데이터)
- Rankings 스크래핑 (주간 사용량)
- 오픈웨이트 모델 필터링 (`hugging_face_id` 기반)
- HuggingFace API 라이선스 조회
- 모델별 Apps 정보 수집
- 마크다운 리포트 생성

### Must NOT Have (Guardrails)
- 3개 이상 모듈 분리 금지 (단순 구조 유지)
- 설정 파일 시스템 금지 (하드코딩 또는 CLI 인자만)
- 데이터베이스/캐싱 시스템 금지
- JSON/CSV 등 추가 출력 포맷 금지
- 웹 서버/API 엔드포인트 금지
- 병렬 스크래핑 금지 (순차 실행으로 rate limit 회피)
- Zod, Commander 등 불필요한 의존성 금지

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (새 프로젝트)
- **User wants tests**: TDD
- **Framework**: bun test (Bun 내장)

### Test Infrastructure Setup (Task 1에서 수행)
```bash
# Verify bun test works
bun test --help
# Expected: help output shows

# Create first test file and verify
bun test
# Expected: test runs (may be 0 tests initially)
```

### TDD Workflow
Each TODO follows RED-GREEN-REFACTOR:

1. **RED**: Write failing test first
   - Test file: `src/__tests__/*.test.ts`
   - Test command: `bun test`
   - Expected: FAIL (test exists, implementation doesn't)

2. **GREEN**: Implement minimum code to pass
   - Command: `bun test`
   - Expected: PASS

3. **REFACTOR**: Clean up while keeping green
   - Command: `bun test`
   - Expected: PASS (still)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: 프로젝트 초기 설정 + 테스트 인프라
└── (독립 실행)

Wave 2 (After Wave 1):
├── Task 2: OpenRouter API 클라이언트
├── Task 3: HuggingFace API 클라이언트
└── (병렬 가능)

Wave 3 (After Wave 2):
└── Task 4: Playwright 스크래핑 (Rankings + 상세 페이지)

Wave 4 (After Task 2, 3, 4):
└── Task 5: 마크다운 리포트 생성기

Wave 5 (After Task 5):
└── Task 6: CLI 통합 및 최종 검증

Critical Path: Task 1 → Task 2 → Task 4 → Task 5 → Task 6
```

### Dependency Matrix

| Task | Depends On | Blocks    | Can Parallelize With |
| ---- | ---------- | --------- | -------------------- |
| 1    | None       | 2, 3      | None (첫 번째)       |
| 2    | 1          | 4, 5      | 3                    |
| 3    | 1          | 5         | 2                    |
| 4    | 2          | 5         | None                 |
| 5    | 2, 3, 4    | 6         | None                 |
| 6    | 5          | None      | None (마지막)        |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents                                              |
| ---- | ----- | --------------------------------------------------------------- |
| 1    | 1     | `delegate_task(category="quick", load_skills=[])`               |
| 2    | 2, 3  | `delegate_task(category="unspecified-low", load_skills=[])` x2  |
| 3    | 4     | `delegate_task(category="unspecified-high", load_skills=["playwright"])` |
| 4    | 5     | `delegate_task(category="unspecified-low", load_skills=[])`     |
| 5    | 6     | `delegate_task(category="quick", load_skills=["playwright"])`   |

---

## TODOs

### Task 1: 프로젝트 초기 설정 및 테스트 인프라

- [ ] 1. Project Setup & Test Infrastructure

  **What to do**:
  - `bun init` 으로 프로젝트 초기화
  - TypeScript 설정 (`tsconfig.json`)
  - Playwright 설치 (`bun add playwright`)
  - 디렉토리 구조 생성: `src/`, `src/lib/`, `src/__tests__/`
  - 샘플 테스트 파일 생성 및 `bun test` 검증

  **Must NOT do**:
  - ESLint, Prettier 등 린팅 도구 설정 금지
  - Husky, lint-staged 등 git hooks 금지
  - 복잡한 빌드 파이프라인 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 단순 초기화 작업, 파일 생성만 필요
  - **Skills**: `[]`
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (단독)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None (시작점)

  **References**:
  - Bun 공식 문서: https://bun.sh/docs/cli/init
  - Bun test 문서: https://bun.sh/docs/cli/test
  - Playwright Bun 설치: https://playwright.dev/docs/intro

  **Acceptance Criteria**:

  ```bash
  # 1. 프로젝트 파일 존재 확인
  test -f package.json && test -f tsconfig.json
  # Assert: exit code 0

  # 2. Playwright 설치 확인
  bun pm ls | grep playwright
  # Assert: playwright 출력됨

  # 3. 테스트 인프라 동작 확인
  bun test
  # Assert: exit code 0 (0 tests도 OK)

  # 4. 디렉토리 구조 확인
  test -d src/lib && test -d src/__tests__
  # Assert: exit code 0
  ```

  **Commit**: YES
  - Message: `chore: initialize project with Bun and Playwright`
  - Files: `package.json`, `tsconfig.json`, `bun.lockb`, `src/`
  - Pre-commit: `bun test`

---

### Task 2: OpenRouter API 클라이언트 (TDD)

- [ ] 2. OpenRouter API Client with TDD

  **What to do**:
  - **RED**: `src/__tests__/openrouter.test.ts` 작성
    - `fetchModels()` 함수 테스트
    - `filterOpenWeightModels()` 함수 테스트
    - Mock 데이터로 필터링 로직 테스트
  - **GREEN**: `src/lib/openrouter.ts` 구현
    - OpenRouter `/api/v1/models` API 호출
    - `hugging_face_id` 필드로 오픈웨이트 필터링
    - 가격 정보 파싱 (prompt/completion, "-1" = Dynamic 처리)
  - **REFACTOR**: 타입 정의 정리

  **Must NOT do**:
  - API 응답 캐싱 금지
  - Retry 로직 과도하게 복잡하게 금지 (단순 3회 retry만)
  - Zod 스키마 검증 금지 (TypeScript 타입만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: API 호출 + 필터링 로직, 중간 난이도
  - **Skills**: `[]`
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - Bun fetch 사용법: https://bun.sh/docs/api/fetch

  **API References**:
  - OpenRouter Models API: `GET https://openrouter.ai/api/v1/models`
  - 응답 구조 (실제 데이터 기반):
    ```typescript
    interface Model {
      id: string;                    // "deepseek/deepseek-chat"
      canonical_slug: string;
      hugging_face_id: string;       // "" = closed, "deepseek-ai/DeepSeek-V3" = open
      name: string;
      created: number;
      description: string;
      context_length: number;
      architecture: {
        modality: string;            // "text->text", "text+image->text"
        input_modalities: string[];
        output_modalities: string[];
        tokenizer: string;
      };
      pricing: {
        prompt: string;              // "0.30" = $0.30/1M, "-1" = dynamic
        completion: string;
      };
    }
    ```

  **Acceptance Criteria**:

  **TDD Verification**:
  ```bash
  # RED: 테스트 파일 존재 확인
  test -f src/__tests__/openrouter.test.ts
  # Assert: exit code 0

  # GREEN: 테스트 통과 확인
  bun test src/__tests__/openrouter.test.ts
  # Assert: exit code 0, "fetchModels" 테스트 통과

  # 기능 검증: API 호출 테스트
  bun -e "import { fetchModels } from './src/lib/openrouter'; fetchModels().then(m => console.log('Total:', m.length))"
  # Assert: "Total: 3XX" 출력 (300 이상)

  # 기능 검증: 오픈웨이트 필터링
  bun -e "import { fetchModels, filterOpenWeightModels } from './src/lib/openrouter'; fetchModels().then(m => console.log('Open-weight:', filterOpenWeightModels(m).length))"
  # Assert: "Open-weight: 1XX" 출력 (100 이상)
  ```

  **Commit**: YES
  - Message: `feat(api): add OpenRouter API client with open-weight filtering`
  - Files: `src/lib/openrouter.ts`, `src/__tests__/openrouter.test.ts`
  - Pre-commit: `bun test`

---

### Task 3: HuggingFace API 클라이언트 (TDD)

- [ ] 3. HuggingFace API Client for License Info (TDD)

  **What to do**:
  - **RED**: `src/__tests__/huggingface.test.ts` 작성
    - `fetchModelLicense(huggingFaceId)` 함수 테스트
    - Mock 데이터로 라이선스 파싱 테스트
  - **GREEN**: `src/lib/huggingface.ts` 구현
    - HuggingFace API로 모델 라이선스 조회
    - 라이선스 분류: "Fully Open", "Open with Restrictions", "Unknown"
    - Rate limit 고려: 요청 간 500ms 딜레이
  - **REFACTOR**: 에러 처리 정리

  **Must NOT do**:
  - 모든 모델 라이선스 일괄 조회 금지 (필요한 것만)
  - 라이선스 캐싱 금지 (매번 조회)
  - 복잡한 라이선스 분류 금지 (3가지만)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: API 호출 + 간단한 파싱
  - **Skills**: `[]`
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **API References**:
  - HuggingFace Model API: `GET https://huggingface.co/api/models/{model_id}`
  - 응답에서 `license` 필드 추출
  - 라이선스 분류:
    - Fully Open: `apache-2.0`, `mit`, `bsd-3-clause`, `cc-by-4.0`
    - Open with Restrictions: `llama2`, `llama3`, `gemma`, `cc-by-nc-4.0`
    - Unknown: 그 외 모든 값

  **Acceptance Criteria**:

  **TDD Verification**:
  ```bash
  # RED: 테스트 파일 존재 확인
  test -f src/__tests__/huggingface.test.ts
  # Assert: exit code 0

  # GREEN: 테스트 통과 확인
  bun test src/__tests__/huggingface.test.ts
  # Assert: exit code 0

  # 기능 검증: 라이선스 조회
  bun -e "import { fetchModelLicense } from './src/lib/huggingface'; fetchModelLicense('deepseek-ai/DeepSeek-V3').then(l => console.log('License:', l))"
  # Assert: License 카테고리 출력
  ```

  **Commit**: YES
  - Message: `feat(api): add HuggingFace API client for license lookup`
  - Files: `src/lib/huggingface.ts`, `src/__tests__/huggingface.test.ts`
  - Pre-commit: `bun test`

---

### Task 4: Playwright 스크래핑 (Rankings + 모델 상세 페이지)

- [ ] 4. Playwright Scraping for Rankings and Model Details (TDD)

  **What to do**:
  - **RED**: `src/__tests__/scraper.test.ts` 작성
    - `scrapeRankings()` 함수 테스트 (mock 사용)
    - `scrapeModelApps(modelId)` 함수 테스트
  - **GREEN**: `src/lib/scraper.ts` 구현
    - `/rankings` 페이지 스크래핑: Top Models, 주간 사용량
    - 모델 상세 페이지 Apps 탭 스크래핑
    - 요청 간 2초 딜레이 (rate limit 회피)
    - Playwright headless 모드 사용
  - **REFACTOR**: 셀렉터 정리, 에러 처리

  **Must NOT do**:
  - 병렬 스크래핑 금지 (순차 실행)
  - 모든 모델 스크래핑 금지 (오픈웨이트만)
  - Performance, Activity, Uptime 탭 스크래핑 금지 (Apps만)
  - 스크린샷 저장 금지 (데이터만 추출)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Playwright 스크래핑은 brittle, 셀렉터 찾기 필요
  - **Skills**: `["playwright"]`
    - `playwright`: 브라우저 자동화 필수

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (단독)
  - **Blocks**: Task 5
  - **Blocked By**: Task 2 (오픈웨이트 모델 목록 필요)

  **References**:

  **Pattern References**:
  - Playwright Bun 사용: https://playwright.dev/docs/library

  **Page References**:
  - Rankings 페이지: `https://openrouter.ai/rankings`
    - Top Models 섹션: 모델명, 주간 토큰 사용량
    - 데이터가 Next.js `self.__next_f.push()` 스크립트에 임베딩됨
  - 모델 상세 페이지: `https://openrouter.ai/{provider}/{model}`
    - Apps 탭: 이 모델을 사용하는 앱 목록
    - 예시: `https://openrouter.ai/deepseek/deepseek-chat`

  **Acceptance Criteria**:

  **TDD Verification**:
  ```bash
  # RED: 테스트 파일 존재
  test -f src/__tests__/scraper.test.ts
  # Assert: exit code 0

  # GREEN: 테스트 통과
  bun test src/__tests__/scraper.test.ts
  # Assert: exit code 0
  ```

  **Playwright 기능 검증** (using playwright skill):
  ```
  # Agent executes via playwright browser automation:
  1. Navigate to: https://openrouter.ai/rankings
  2. Wait for: selector containing "Top Models" or leaderboard data
  3. Extract: Model names and token counts from the page
  4. Assert: At least 10 models extracted
  5. Navigate to: https://openrouter.ai/deepseek/deepseek-chat
  6. Click: "Apps" tab if visible
  7. Extract: App names using this model
  8. Assert: At least 1 app extracted (or graceful "No apps" handling)
  ```

  **Commit**: YES
  - Message: `feat(scraper): add Playwright scraping for rankings and model apps`
  - Files: `src/lib/scraper.ts`, `src/__tests__/scraper.test.ts`
  - Pre-commit: `bun test`

---

### Task 5: 마크다운 리포트 생성기 (TDD)

- [ ] 5. Markdown Report Generator (TDD)

  **What to do**:
  - **RED**: `src/__tests__/report.test.ts` 작성
    - `generateReport(data)` 함수 테스트
    - 테이블 포맷팅 테스트
  - **GREEN**: `src/lib/report.ts` 구현
    - 수집된 데이터를 마크다운 리포트로 변환
    - 섹션 구성:
      1. 요약 (총 모델 수, 날짜)
      2. Top 20 인기 오픈웨이트 모델 (주간 사용량 순)
      3. 가격 비교 테이블
      4. 라이선스별 모델 목록
      5. 카테고리별 인기 모델 (코딩, 채팅 등)
      6. 모델별 사용 앱 정보
  - **REFACTOR**: 테이블 정렬, 가독성 개선

  **Must NOT do**:
  - HTML, JSON, CSV 출력 금지 (마크다운만)
  - 차트 이미지 생성 금지 (텍스트 테이블만)
  - 템플릿 엔진 사용 금지 (문자열 조합)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 데이터 변환, 문자열 처리
  - **Skills**: `[]`
    - 특별한 스킬 불필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (단독)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 2, 3, 4

  **References**:

  **Output Format Reference**:
  ```markdown
  # OpenRouter Open-Weight Model Report

  > Generated: 2026-02-02
  > Total Open-Weight Models: 193
  > Data Source: OpenRouter.ai

  ## Top 20 Popular Open-Weight Models

  | Rank | Model | Provider | Weekly Tokens | Price (Input/Output) |
  |------|-------|----------|---------------|---------------------|
  | 1 | DeepSeek V3 | DeepSeek | 508B | $0.30/$1.20 |
  | ... | ... | ... | ... | ... |

  ## Price Comparison

  | Model | Input ($/1M) | Output ($/1M) | Context |
  |-------|--------------|---------------|---------|
  | ... | ... | ... | ... |

  ## License Classification

  ### Fully Open (Commercial OK)
  - Model A (Apache 2.0)
  - ...

  ### Open with Restrictions
  - Model B (Llama License)
  - ...

  ## Models by Category

  ### Coding
  | Model | Weekly Usage |
  | ... | ... |

  ### Chat/Assistant
  | Model | Weekly Usage |
  | ... | ... |

  ## App Usage

  | Model | Used By |
  |-------|---------|
  | DeepSeek V3 | Kilo Code, Cline, ... |
  | ... | ... |
  ```

  **Acceptance Criteria**:

  **TDD Verification**:
  ```bash
  # RED: 테스트 파일 존재
  test -f src/__tests__/report.test.ts
  # Assert: exit code 0

  # GREEN: 테스트 통과
  bun test src/__tests__/report.test.ts
  # Assert: exit code 0
  ```

  **기능 검증**:
  ```bash
  # Mock 데이터로 리포트 생성 테스트
  bun -e "
  import { generateReport } from './src/lib/report';
  const mockData = {
    models: [{id: 'test', name: 'Test', pricing: {prompt: '0.1', completion: '0.2'}}],
    rankings: [{model: 'test', tokens: 1000000}],
    licenses: {'test': 'Fully Open'},
    apps: {'test': ['App1']}
  };
  const report = generateReport(mockData);
  console.log(report.substring(0, 500));
  "
  # Assert: 마크다운 헤더와 테이블 구조 출력
  ```

  **Commit**: YES
  - Message: `feat(report): add markdown report generator`
  - Files: `src/lib/report.ts`, `src/__tests__/report.test.ts`
  - Pre-commit: `bun test`

---

### Task 6: CLI 통합 및 최종 검증

- [ ] 6. CLI Integration and Final Verification

  **What to do**:
  - `src/index.ts` 메인 진입점 구현
    - Phase 1: API 데이터 수집 (OpenRouter + HuggingFace)
    - Phase 2: Playwright 스크래핑 (Rankings + Apps)
    - 리포트 생성 및 `report.md` 파일 저장
  - `package.json`에 `"scripts": { "scrape": "bun run src/index.ts" }` 추가
  - 에러 처리: 각 단계 실패 시 명확한 메시지
  - 진행 상황 콘솔 출력

  **Must NOT do**:
  - CLI 인자 파서 라이브러리 금지 (필요시 process.argv 직접)
  - 로그 라이브러리 금지 (console.log만)
  - 진행률 바 라이브러리 금지

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 기존 모듈 통합만, 새 로직 적음
  - **Skills**: `["playwright"]`
    - `playwright`: 최종 E2E 검증에 필요

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (최종)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:

  **Integration Pattern**:
  ```typescript
  // src/index.ts 구조
  import { fetchModels, filterOpenWeightModels } from './lib/openrouter';
  import { fetchModelLicense } from './lib/huggingface';
  import { scrapeRankings, scrapeModelApps } from './lib/scraper';
  import { generateReport } from './lib/report';

  async function main() {
    console.log('Phase 1: Fetching API data...');
    const models = await fetchModels();
    const openWeightModels = filterOpenWeightModels(models);
    console.log(`Found ${openWeightModels.length} open-weight models`);

    // HuggingFace 라이선스 조회
    const licenses = {};
    for (const model of openWeightModels) {
      if (model.hugging_face_id) {
        licenses[model.id] = await fetchModelLicense(model.hugging_face_id);
      }
    }

    console.log('Phase 2: Scraping rankings and apps...');
    const rankings = await scrapeRankings();
    const apps = {};
    for (const model of openWeightModels.slice(0, 50)) { // Top 50만
      apps[model.id] = await scrapeModelApps(model.id);
    }

    console.log('Generating report...');
    const report = generateReport({ models: openWeightModels, rankings, licenses, apps });
    await Bun.write('report.md', report);
    console.log('Done! Report saved to report.md');
  }

  main().catch(console.error);
  ```

  **Acceptance Criteria**:

  **CLI 실행 검증**:
  ```bash
  # 전체 실행
  bun run scrape
  # Assert: exit code 0

  # 리포트 파일 생성 확인
  test -f report.md
  # Assert: exit code 0

  # 리포트 내용 검증
  grep -c "^|" report.md
  # Assert: 20 이상 (테이블 행)

  grep "Open-Weight" report.md
  # Assert: 매칭됨

  # 실행 시간 검증
  time bun run scrape
  # Assert: 20분 이내
  ```

  **Playwright E2E 검증** (using playwright skill):
  ```
  # Agent executes:
  1. Run: bun run scrape
  2. Wait for: process to complete
  3. Read: report.md file
  4. Assert: Contains "# OpenRouter" header
  5. Assert: Contains table with "DeepSeek" (popular open-weight)
  6. Assert: Contains "License" section
  ```

  **Commit**: YES
  - Message: `feat: complete CLI integration for report generation`
  - Files: `src/index.ts`, `package.json`
  - Pre-commit: `bun test && bun run scrape`

---

## Commit Strategy

| After Task | Message                                                        | Files                                 | Verification     |
| ---------- | -------------------------------------------------------------- | ------------------------------------- | ---------------- |
| 1          | `chore: initialize project with Bun and Playwright`            | package.json, tsconfig.json, src/     | `bun test`       |
| 2          | `feat(api): add OpenRouter API client with open-weight filter` | src/lib/openrouter.ts, tests          | `bun test`       |
| 3          | `feat(api): add HuggingFace API client for license lookup`     | src/lib/huggingface.ts, tests         | `bun test`       |
| 4          | `feat(scraper): add Playwright scraping for rankings and apps` | src/lib/scraper.ts, tests             | `bun test`       |
| 5          | `feat(report): add markdown report generator`                  | src/lib/report.ts, tests              | `bun test`       |
| 6          | `feat: complete CLI integration for report generation`         | src/index.ts, package.json            | `bun run scrape` |

---

## Success Criteria

### Verification Commands
```bash
# 1. 모든 테스트 통과
bun test
# Expected: All tests pass, exit code 0

# 2. CLI 실행 성공
bun run scrape
# Expected: exit code 0, "Done!" 메시지

# 3. 리포트 파일 생성
test -f report.md && echo "Report exists"
# Expected: "Report exists"

# 4. 리포트 내용 검증
grep -c "^|" report.md
# Expected: 20+ (테이블 행 수)

# 5. 오픈웨이트 모델 수 검증
grep -o "Total Open-Weight Models: [0-9]*" report.md
# Expected: 100 이상

# 6. 실행 시간
time bun run scrape
# Expected: 20분 이내
```

### Final Checklist
- [ ] All "Must Have" present:
  - [ ] OpenRouter API 데이터 수집
  - [ ] Rankings 스크래핑
  - [ ] 오픈웨이트 모델 필터링
  - [ ] HuggingFace 라이선스 조회
  - [ ] 모델별 Apps 정보 수집
  - [ ] 마크다운 리포트 생성
- [ ] All "Must NOT Have" absent:
  - [ ] 3개 이상 모듈 분리 없음 (openrouter, huggingface, scraper, report = 4개는 OK)
  - [ ] 설정 파일 없음
  - [ ] DB/캐싱 없음
  - [ ] 추가 출력 포맷 없음
- [ ] All tests pass (`bun test`)
- [ ] CLI 실행 성공 (`bun run scrape`)
- [ ] 리포트에 100+ 오픈웨이트 모델 포함
