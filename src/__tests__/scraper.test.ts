import { describe, expect, setDefaultTimeout, test } from "bun:test";
import {
  type ModelApps,
  type RankingEntry,
  scrapeModelApps,
  scrapeRankings,
} from "../lib/scraper";

const WEEKLY_TOKENS_REGEX = /\d+/;

setDefaultTimeout(120_000);

let cachedRankings: RankingEntry[] | null = null;
let cachedApps: ModelApps | null = null;

async function getRankings(): Promise<RankingEntry[]> {
  if (!cachedRankings) {
    cachedRankings = await scrapeRankings();
  }
  return cachedRankings;
}

async function getApps(): Promise<ModelApps> {
  if (!cachedApps) {
    cachedApps = await scrapeModelApps("deepseek/deepseek-chat");
  }
  return cachedApps;
}

describe("Playwright Scraper", () => {
  describe("scrapeRankings", () => {
    test("should return an array of ranking entries", async () => {
      const rankings = await getRankings();

      expect(rankings).toBeDefined();
      expect(Array.isArray(rankings)).toBe(true);
    });

    test("should extract at least 10 models from rankings page", async () => {
      const rankings = await getRankings();

      expect(rankings.length).toBeGreaterThanOrEqual(10);
    });

    test("should include modelId in provider/model format", async () => {
      const rankings = await getRankings();

      const hasValidFormat = rankings.some((r) => r.modelId?.includes("/"));
      expect(hasValidFormat).toBe(true);
    });

    test("should include modelName for each entry", async () => {
      const rankings = await getRankings();

      for (const ranking of rankings) {
        expect(ranking.modelName).toBeDefined();
        expect(ranking.modelName.length).toBeGreaterThan(0);
      }
    });

    test("should include weeklyTokens for each entry", async () => {
      const rankings = await getRankings();

      for (const ranking of rankings) {
        expect(ranking.weeklyTokens).toBeDefined();
        expect(ranking.weeklyTokens).toMatch(WEEKLY_TOKENS_REGEX);
      }
    });
  });

  describe("scrapeModelApps", () => {
    test("should return ModelApps object with modelId", async () => {
      const result = await getApps();

      expect(result).toBeDefined();
      expect(result.modelId).toBe("deepseek/deepseek-chat");
    });

    test("should return apps array", async () => {
      const result = await getApps();

      expect(result.apps).toBeDefined();
      expect(Array.isArray(result.apps)).toBe(true);
    });

    test("should extract app names from Apps tab", async () => {
      const result = await getApps();

      expect(result.apps.length).toBeGreaterThanOrEqual(1);
    });

    test("should return app names as non-empty strings", async () => {
      const result = await getApps();

      for (const app of result.apps) {
        expect(typeof app).toBe("string");
        expect(app.length).toBeGreaterThan(0);
      }
    });

    test("should handle non-existent models gracefully", async () => {
      const result = await scrapeModelApps("nonexistent/model-xyz-123");

      expect(result).toBeDefined();
      expect(result.modelId).toBe("nonexistent/model-xyz-123");
      expect(Array.isArray(result.apps)).toBe(true);
    });
  });

  describe("Rate limiting", () => {
    test("should respect 2-second delay between requests", async () => {
      const startTime = Date.now();

      await scrapeRankings();
      await scrapeModelApps("anthropic/claude-sonnet-4.5");

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });
  });

  describe("TypeScript types", () => {
    test("RankingEntry should have correct shape", async () => {
      const rankings = await getRankings();

      if (rankings.length === 0) {
        expect(true).toBe(true);
        return;
      }

      const firstRanking = rankings[0];
      if (!firstRanking) {
        expect(true).toBe(true);
        return;
      }

      const id: string = firstRanking.modelId;
      const name: string = firstRanking.modelName;
      const tokens: string = firstRanking.weeklyTokens;

      expect(typeof id).toBe("string");
      expect(typeof name).toBe("string");
      expect(typeof tokens).toBe("string");
    });

    test("ModelApps should have correct shape", async () => {
      const result: ModelApps = await getApps();

      const id: string = result.modelId;
      const apps: string[] = result.apps;

      expect(typeof id).toBe("string");
      expect(Array.isArray(apps)).toBe(true);
    });
  });
});
