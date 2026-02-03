import { fetchModelLicense } from "./lib/huggingface";
import {
  fetchModels,
  filterOpenWeightModels,
  type Model,
} from "./lib/openrouter";
import { generateReport } from "./lib/report";
import {
  closeBrowser,
  type ModelActivity,
  scrapeModelActivity,
  scrapeModelApps,
} from "./lib/scraper";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Operation timeout")), timeoutMs)
    ),
  ]);
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

    console.log("Generating report...");
    const report = generateReport({
      models: openWeightModels,
      activities,
      licenses,
      apps,
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
