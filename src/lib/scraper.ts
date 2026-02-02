import { type Browser, chromium } from "playwright";

export interface RankingEntry {
  modelId: string;
  modelName: string;
  weeklyTokens: string;
}

export interface ModelApps {
  modelId: string;
  apps: string[];
}

const RANKINGS_URL = "https://openrouter.ai/rankings";
const MODEL_BASE_URL = "https://openrouter.ai";
const RATE_LIMIT_DELAY_MS = 2000;
const WEEKLY_TOKENS_PATTERN_SOURCE = "(\\d+(?:\\.\\d+)?[KMBT]?B?)\\s*tokens";
const WEEKLY_TOKENS_PATTERN_FLAGS = "i";
const TOKEN_COUNT_REGEX = /([\d.]+)\s*([KMBT]?)/i;
const ACTIVITY_TOKEN_PATTERN_SOURCE = "([\\d.]+[KMBT]?)$";
const ACTIVITY_TOKEN_PATTERN_FLAGS = "i";
const CATEGORY_PATTERN_SOURCE = "^([A-Za-z\\s]+)\\s*\\(#\\d+\\)$";
const Y_LABEL_PATTERN_SOURCE = "([\\d.]+)\\s*([KMBT]?)";
const Y_LABEL_PATTERN_FLAGS = "i";
const APP_SANITIZE_PATTERN_SOURCE = "[^\\w\\s'-]";
const APP_SANITIZE_PATTERN_FLAGS = "g";

let lastRequestTime = 0;

async function rateLimitDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (lastRequestTime > 0 && elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed)
    );
  }
  lastRequestTime = Date.now();
}

function createBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function scrapeRankings(): Promise<RankingEntry[]> {
  let browser: Browser | null = null;

  try {
    await rateLimitDelay();
    browser = await createBrowser();
    const page = await browser.newPage();

    await page.goto(RANKINGS_URL, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });
    await page.waitForTimeout(2000);

    for (let i = 0; i < 10; i++) {
      try {
        const showMoreButton = page
          .locator('button:has-text("Show more")')
          .first();
        if (await showMoreButton.isVisible({ timeout: 2000 })) {
          await showMoreButton.click();
          await page.waitForTimeout(1500);
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    const rankings: RankingEntry[] = await page.evaluate(
      ({ tokenPatternSource, tokenPatternFlags }) => {
        const results: {
          modelId: string;
          modelName: string;
          weeklyTokens: string;
        }[] = [];
        const seenModels = new Set<string>();

        const singleSegmentExcluded = new Set([
          "docs",
          "chat",
          "rankings",
          "apps",
          "models",
          "providers",
          "settings",
          "compare",
          "api",
          "enterprise",
          "careers",
          "about",
          "privacy",
          "terms",
          "support",
          "sdk",
          "pricing",
          "announcements",
          "partners",
          "state-of-ai",
          "works-with-openrouter",
        ]);

        const tokenPattern = new RegExp(tokenPatternSource, tokenPatternFlags);

        const allLinks = document.querySelectorAll('a[href^="/"]');

        function extractModelId(href: string): string | null {
          const segments = href.split("/").filter(Boolean);
          if (segments.length !== 2) {
            return null;
          }
          const provider = segments[0];
          const model = segments[1];
          if (!(provider && model)) {
            return null;
          }
          if (
            singleSegmentExcluded.has(provider) ||
            singleSegmentExcluded.has(model)
          ) {
            return null;
          }
          return `${provider}/${model}`;
        }

        function isValidModelName(name: string): boolean {
          if (!name || name.length < 2) {
            return false;
          }
          if (name.includes("/")) {
            return false;
          }
          if (name === "by") {
            return false;
          }
          return true;
        }

        function findTokensText(link: Element): string {
          let tokensText = "";
          let current = link.parentElement;
          for (let i = 0; i < 8 && current; i++) {
            const text = current.textContent || "";
            const tokenMatch = text.match(tokenPattern);
            if (tokenMatch?.[1]) {
              tokensText = tokenMatch[1];
              break;
            }
            current = current.parentElement;
          }
          return tokensText;
        }

        for (const link of Array.from(allLinks)) {
          const href = link.getAttribute("href") || "";
          const modelId = extractModelId(href);
          if (!modelId) {
            continue;
          }
          if (seenModels.has(modelId)) {
            continue;
          }

          const modelName = link.textContent?.trim() || "";
          if (!isValidModelName(modelName)) {
            continue;
          }

          const tokensText = findTokensText(link);
          if (!tokensText) {
            continue;
          }

          seenModels.add(modelId);
          results.push({
            modelId,
            modelName,
            weeklyTokens: tokensText,
          });
        }

        return results;
      },
      {
        tokenPatternSource: WEEKLY_TOKENS_PATTERN_SOURCE,
        tokenPatternFlags: WEEKLY_TOKENS_PATTERN_FLAGS,
      }
    );

    return rankings;
  } catch (error) {
    console.error("Error scraping rankings:", error);
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export interface ModelActivity {
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  categories: string[];
}

function parseTokenCount(text: string): number {
  const match = text.match(TOKEN_COUNT_REGEX);
  if (!match) {
    return 0;
  }

  const numText = match[1];
  if (!numText) {
    return 0;
  }
  const num = Number.parseFloat(numText);
  const suffix = match[2] ? match[2].toUpperCase() : "";

  const multipliers: Record<string, number> = {
    "": 1,
    K: 1000,
    M: 1_000_000,
    B: 1_000_000_000,
    T: 1_000_000_000_000,
  };

  return num * (multipliers[suffix] || 1);
}

export async function scrapeModelActivity(
  modelId: string
): Promise<ModelActivity> {
  let browser: Browser | null = null;

  try {
    await rateLimitDelay();
    browser = await createBrowser();
    const page = await browser.newPage();

    const activityUrl = `${MODEL_BASE_URL}/${modelId}/activity`;

    const response = await page.goto(activityUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });

    if (!response || response.status() >= 400) {
      return {
        modelId,
        promptTokens: 0,
        completionTokens: 0,
        reasoningTokens: 0,
        totalTokens: 0,
        categories: [],
      };
    }

    await page.waitForTimeout(2000);

    const data = await page.evaluate(
      ({ tokenPatternSource, tokenPatternFlags, categoryPatternSource }) => {
        const result = {
          promptTokens: "",
          completionTokens: "",
          reasoningTokens: "",
          categories: [] as string[],
        };

        const tokenPattern = new RegExp(tokenPatternSource, tokenPatternFlags);
        const categoryPattern = new RegExp(categoryPatternSource);

        function setTokenValue(label: string | null, value: string) {
          if (label === "Prompt") {
            result.promptTokens = value;
            return;
          }
          if (label === "Completion") {
            result.completionTokens = value;
            return;
          }
          if (label === "Reasoning") {
            result.reasoningTokens = value;
          }
        }

        const tokenElements = document.querySelectorAll(
          '[aria-label="Prompt"], [aria-label="Completion"], [aria-label="Reasoning"]'
        );
        for (const el of Array.from(tokenElements)) {
          const ariaLabel = el.getAttribute("aria-label");
          const text = el.textContent?.trim() || "";
          const match = text.match(tokenPattern);
          if (match?.[1]) {
            setTokenValue(ariaLabel, match[1]);
          }
        }

        const buttons = document.querySelectorAll("button");
        for (const btn of Array.from(buttons)) {
          const fullText = btn.textContent?.trim() || "";
          if (categoryPattern.test(fullText)) {
            result.categories.push(fullText);
          }
        }

        return result;
      },
      {
        tokenPatternSource: ACTIVITY_TOKEN_PATTERN_SOURCE,
        tokenPatternFlags: ACTIVITY_TOKEN_PATTERN_FLAGS,
        categoryPatternSource: CATEGORY_PATTERN_SOURCE,
      }
    );

    const promptTokens = parseTokenCount(data.promptTokens);
    const completionTokens = parseTokenCount(data.completionTokens);
    const reasoningTokens = parseTokenCount(data.reasoningTokens);
    const totalTokens = promptTokens + completionTokens + reasoningTokens;

    return {
      modelId,
      promptTokens,
      completionTokens,
      reasoningTokens,
      totalTokens,
      categories: data.categories,
    };
  } catch (_error) {
    return {
      modelId,
      promptTokens: 0,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      categories: [],
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export interface DailyTokenUsage {
  date: string;
  tokens: number;
}

export interface ModelHistoricalData {
  modelId: string;
  dailyUsage: DailyTokenUsage[];
  yAxisMax: number;
}

export async function scrapeModelHistoricalData(
  modelId: string
): Promise<ModelHistoricalData> {
  let browser: Browser | null = null;

  try {
    await rateLimitDelay();
    browser = await createBrowser();
    const page = await browser.newPage();

    const activityUrl = `${MODEL_BASE_URL}/${modelId}/activity`;

    const response = await page.goto(activityUrl, {
      waitUntil: "networkidle",
      timeout: 20_000,
    });

    if (!response || response.status() >= 400) {
      return { modelId, dailyUsage: [], yAxisMax: 0 };
    }

    await page.waitForTimeout(2500);

    const chartData = await page.evaluate(
      ({ yLabelPatternSource, yLabelPatternFlags }) => {
        const labelPattern = new RegExp(
          yLabelPatternSource,
          yLabelPatternFlags
        );

        function collectYAxisLabels(): string[] {
          const yAxisTicks = document.querySelectorAll(
            ".recharts-yAxis .recharts-cartesian-axis-tick-value"
          );
          const yLabels: string[] = [];
          for (const tick of Array.from(yAxisTicks)) {
            const text = tick.textContent?.trim() || "";
            if (text) {
              yLabels.push(text);
            }
          }
          return yLabels;
        }

        function parseLabelValue(label: string): number | null {
          const match = label.match(labelPattern);
          if (!match) {
            return null;
          }
          const numText = match[1];
          if (!numText) {
            return null;
          }
          const num = Number.parseFloat(numText);
          const suffix = (match[2] || "").toUpperCase();
          const multipliers: Record<string, number> = {
            "": 1,
            K: 1000,
            M: 1_000_000,
            B: 1_000_000_000,
            T: 1_000_000_000_000,
          };
          return num * (multipliers[suffix] || 1);
        }

        function computeYAxisMax(labels: string[]): number {
          let maxValue = 0;
          for (const label of labels) {
            const value = parseLabelValue(label);
            if (value !== null && value > maxValue) {
              maxValue = value;
            }
          }
          return maxValue;
        }

        function collectBarHeights(): { y: number; height: number }[] {
          const bars = document.querySelectorAll(
            ".recharts-bar-rectangle path"
          );
          const barHeights: { y: number; height: number }[] = [];
          for (const bar of Array.from(bars)) {
            const yAttr = bar.getAttribute("y");
            const heightAttr = bar.getAttribute("height");
            if (yAttr && heightAttr) {
              barHeights.push({
                y: Number.parseFloat(yAttr),
                height: Number.parseFloat(heightAttr),
              });
            }
          }
          return barHeights;
        }

        function getSvgHeight(): number {
          const svg = document.querySelector(".recharts-surface");
          return svg
            ? Number.parseFloat(svg.getAttribute("height") || "320")
            : 320;
        }

        const yLabels = collectYAxisLabels();
        const yAxisMax = computeYAxisMax(yLabels);
        const barHeights = collectBarHeights();
        const svgHeight = getSvgHeight();

        const chartAreaTop = 10;
        const chartAreaBottom = svgHeight - 30;
        const chartAreaHeight = chartAreaBottom - chartAreaTop;

        return { yAxisMax, barHeights, chartAreaHeight, svgHeight };
      },
      {
        yLabelPatternSource: Y_LABEL_PATTERN_SOURCE,
        yLabelPatternFlags: Y_LABEL_PATTERN_FLAGS,
      }
    );

    const bars = await page.$$(".recharts-bar-rectangle path");
    const dailyUsage: DailyTokenUsage[] = [];

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      if (!bar) {
        continue;
      }

      await bar.hover();
      await page.waitForTimeout(80);

      const tooltipText = await page.evaluate(() => {
        const tooltip = document.querySelector(".recharts-tooltip-wrapper");
        return tooltip?.textContent?.trim() || "";
      });

      const barHeight = chartData.barHeights[i];
      if (tooltipText && barHeight) {
        const tokens =
          (barHeight.height / chartData.chartAreaHeight) * chartData.yAxisMax;

        dailyUsage.push({
          date: tooltipText,
          tokens: Math.round(tokens),
        });
      }
    }

    return {
      modelId,
      dailyUsage,
      yAxisMax: chartData.yAxisMax,
    };
  } catch (error) {
    console.error(`Error scraping historical data for ${modelId}:`, error);
    return { modelId, dailyUsage: [], yAxisMax: 0 };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function scrapeModelApps(modelId: string): Promise<ModelApps> {
  let browser: Browser | null = null;

  try {
    await rateLimitDelay();
    browser = await createBrowser();
    const page = await browser.newPage();

    const appsUrl = `${MODEL_BASE_URL}/${modelId}/apps`;

    const response = await page.goto(appsUrl, {
      waitUntil: "networkidle",
      timeout: 15_000,
    });

    if (!response || response.status() >= 400) {
      return { modelId, apps: [] };
    }

    await page.waitForTimeout(1000);

    const apps = await page.evaluate(
      ({ appSanitizeSource, appSanitizeFlags }) => {
        const appNames: string[] = [];
        const seenApps = new Set<string>();
        const sanitizePattern = new RegExp(appSanitizeSource, appSanitizeFlags);

        const appLinks = Array.from(
          document.querySelectorAll('a[href*="/apps?url="]')
        );

        function extractAppName(link: Element): string {
          const childNodes = Array.from(link.childNodes);
          for (const node of childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              const nodeText = node.textContent?.trim();
              if (nodeText) {
                return nodeText;
              }
            }
          }

          const firstLine = link.textContent?.split("\n")[0]?.trim();
          return firstLine || "";
        }

        for (const link of appLinks) {
          const rawText = extractAppName(link);
          if (!rawText) {
            continue;
          }

          const text = rawText.replace(sanitizePattern, "").trim();
          if (text.length <= 1) {
            continue;
          }

          const dedupeKey = text.toLowerCase();
          if (seenApps.has(dedupeKey)) {
            continue;
          }

          seenApps.add(dedupeKey);
          appNames.push(text);
        }

        return appNames;
      },
      {
        appSanitizeSource: APP_SANITIZE_PATTERN_SOURCE,
        appSanitizeFlags: APP_SANITIZE_PATTERN_FLAGS,
      }
    );

    return { modelId, apps };
  } catch (error) {
    console.error(`Error scraping apps for ${modelId}:`, error);
    return { modelId, apps: [] };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
