import { fetchModelLicense } from "./lib/huggingface";
import {
  fetchModels,
  filterOpenWeightModels,
  type Model,
} from "./lib/openrouter";
import { generateReport } from "./lib/report";
import {
  closeBrowser,
  type DailyTokenUsage,
  type ModelActivity,
  scrapeModelActivity,
  scrapeModelApps,
  scrapeModelHistoricalData,
} from "./lib/scraper";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timeout")), timeoutMs)
    ),
  ]);
}

const HISTORICAL_TIMEOUT_MS = 90_000;
const HISTORICAL_CANDIDATE_COUNT = 50;
const DATE_PATTERN_SLASH = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const DATE_PATTERN_DASH = /(\d{4})-(\d{1,2})-(\d{1,2})/;
const DATE_PATTERN_TEXT = /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/;
const DATE_PATTERN_TEXT_NO_YEAR = /([A-Za-z]+)\s+(\d{1,2})/;

function parseMonthIndex(monthText: string): number | null {
  const month = monthText.toLowerCase();
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const index = months.findIndex((m) => month.startsWith(m));
  return index >= 0 ? index : null;
}

function parseDate(dateStr: string): Date | null {
  let match = dateStr.match(DATE_PATTERN_SLASH);
  if (match?.[1] && match[2] && match[3]) {
    return new Date(
      Number.parseInt(match[3], 10),
      Number.parseInt(match[1], 10) - 1,
      Number.parseInt(match[2], 10)
    );
  }

  match = dateStr.match(DATE_PATTERN_DASH);
  if (match?.[1] && match[2] && match[3]) {
    return new Date(
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10) - 1,
      Number.parseInt(match[3], 10)
    );
  }

  match = dateStr.match(DATE_PATTERN_TEXT);
  if (match) {
    return new Date(dateStr);
  }

  match = dateStr.match(DATE_PATTERN_TEXT_NO_YEAR);
  if (match?.[1] && match[2]) {
    const monthIndex = parseMonthIndex(match[1]);
    if (monthIndex === null) {
      return null;
    }

    const day = Number.parseInt(match[2], 10);
    const now = new Date();
    let year = now.getFullYear();
    if (monthIndex > now.getMonth()) {
      year -= 1;
    }
    return new Date(year, monthIndex, day);
  }

  return null;
}

function filterToYesterday(dailyUsage: DailyTokenUsage[]): DailyTokenUsage[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return dailyUsage.filter((entry) => {
    const entryDate = parseDate(entry.date.trim());
    if (!entryDate) {
      return false;
    }

    entryDate.setHours(0, 0, 0, 0);
    return entryDate < today;
  });
}

async function fetchLicensesForModels(
  openWeightModels: Model[],
  batchSize: number
): Promise<Record<string, string>> {
  const licenses: Record<string, string> = {};
  const modelsWithHfId = openWeightModels.filter((m) => m.hugging_face_id);

  console.log(
    `  Fetching licenses for ${modelsWithHfId.length} models (batch size: ${batchSize})...`
  );

  for (let i = 0; i < modelsWithHfId.length; i += batchSize) {
    const batch = modelsWithHfId.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (model) => {
        const license = await fetchModelLicense(model.hugging_face_id);
        return { id: model.id, license };
      })
    );

    for (const { id, license } of results) {
      licenses[id] = license;
    }

    console.log(
      `  Processed ${Math.min(i + batchSize, modelsWithHfId.length)}/${modelsWithHfId.length} licenses`
    );
  }

  console.log(`Fetched licenses for ${Object.keys(licenses).length} models`);
  return licenses;
}

async function scrapeWithRetry(
  modelId: string,
  retries = 3
): Promise<ModelActivity> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await new Promise((r) => setTimeout(r, 500));
      return await withTimeout(scrapeModelActivity(modelId), 30_000);
    } catch {
      if (attempt === retries) {
        return {
          modelId,
          promptTokens: 0,
          completionTokens: 0,
          reasoningTokens: 0,
          totalTokens: 0,
          categories: [],
        };
      }
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  return {
    modelId,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
    categories: [],
  };
}

async function scrapeActivitiesForModels(
  openWeightModels: Model[]
): Promise<ModelActivity[]> {
  const activities: ModelActivity[] = [];

  for (let i = 0; i < openWeightModels.length; i++) {
    const model = openWeightModels[i];
    if (!model) {
      continue;
    }
    const result = await scrapeWithRetry(model.id);
    activities.push(result);

    const withData = activities.filter((a) => a.totalTokens > 0).length;
    if ((i + 1) % 10 === 0 || i === openWeightModels.length - 1) {
      console.log(
        `  [${i + 1}/${openWeightModels.length}] Scraped activity (${withData} with usage data)`
      );
    }
  }

  const modelsWithActivity = activities.filter((a) => a.totalTokens > 0);
  console.log(`Found activity data for ${modelsWithActivity.length} models`);
  return activities;
}

async function scrapeAppsForTopModels(
  activities: ModelActivity[],
  openWeightModels: Model[]
): Promise<Record<string, string[]>> {
  const apps: Record<string, string[]> = {};
  const sortedByUsage = [...activities].sort(
    (a, b) => b.totalTokens - a.totalTokens
  );
  const topModelsForApps = sortedByUsage
    .filter((a) => a.totalTokens > 0)
    .slice(0, 20);

  for (let i = 0; i < topModelsForApps.length; i++) {
    const activity = topModelsForApps[i];
    if (!activity) {
      continue;
    }
    try {
      const result = await withTimeout(
        scrapeModelApps(activity.modelId),
        30_000
      );
      if (result.apps.length > 0) {
        apps[activity.modelId] = result.apps;
      }
      const model = openWeightModels.find((m) => m.id === activity.modelId);
      console.log(
        `  [${i + 1}/${topModelsForApps.length}] ${model?.name || activity.modelId}: ${result.apps.length} apps`
      );
    } catch {
      const model = openWeightModels.find((m) => m.id === activity.modelId);
      console.log(
        `  [${i + 1}/${topModelsForApps.length}] ${model?.name || activity.modelId}: timeout`
      );
    }
  }
  console.log(`Found apps for ${Object.keys(apps).length} models`);

  return apps;
}

async function scrapeHistoricalDataForTopModels(
  activities: ModelActivity[]
): Promise<Record<string, DailyTokenUsage[]>> {
  const historicalData: Record<string, DailyTokenUsage[]> = {};
  const sortedByUsage = [...activities].sort(
    (a, b) => b.totalTokens - a.totalTokens
  );
  const topModels = sortedByUsage
    .filter((a) => a.totalTokens > 0)
    .slice(0, HISTORICAL_CANDIDATE_COUNT);

  for (let i = 0; i < topModels.length; i++) {
    const activity = topModels[i];
    if (!activity) {
      continue;
    }

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, 500));
        const result = await withTimeout(
          scrapeModelHistoricalData(activity.modelId),
          HISTORICAL_TIMEOUT_MS
        );
        if (result.dailyUsage.length > 0) {
          const filtered = filterToYesterday(result.dailyUsage);
          if (filtered.length > 0) {
            historicalData[activity.modelId] = filtered;
          }
        }
        console.log(
          `  [${i + 1}/${topModels.length}] ${activity.modelId}: ${result.dailyUsage.length} days`
        );
        break;
      } catch {
        if (attempt === 3) {
          console.log(
            `  [${i + 1}/${topModels.length}] ${activity.modelId}: timeout`
          );
        } else {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
    }
  }

  const collectedCount = Object.keys(historicalData).length;
  console.log(`Collected historical data for ${collectedCount} models`);
  return historicalData;
}

async function main() {
  try {
    console.log("Phase 1: Fetching API data...");
    const models = await fetchModels();
    console.log(`Total models fetched: ${models.length}`);

    const openWeightModels = filterOpenWeightModels(models);
    console.log(`Found ${openWeightModels.length} open-weight models`);

    const licenses = await fetchLicensesForModels(openWeightModels, 10);

    console.log(
      "Phase 2: Scraping activity data for all open-weight models..."
    );
    const activities = await scrapeActivitiesForModels(openWeightModels);

    console.log("Phase 3: Scraping apps for top models...");
    const apps = await scrapeAppsForTopModels(activities, openWeightModels);

    console.log("Phase 4: Scraping historical data for top models...");
    const historicalData = await scrapeHistoricalDataForTopModels(activities);

    console.log("Generating report...");
    const report = generateReport({
      models: openWeightModels,
      activities,
      licenses,
      apps,
      historicalData,
    });

    await Bun.write("report.md", report);
    console.log("Done! Report saved to report.md");

    process.exit(0);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

main();
