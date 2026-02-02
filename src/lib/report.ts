import type { Model } from "./openrouter";
import type { DailyTokenUsage, ModelActivity } from "./scraper";

const TRAILING_ZERO_REGEX = /\.?0+$/;

export interface ReportData {
  models: Model[];
  activities: ModelActivity[];
  licenses: Record<string, string>;
  apps: Record<string, string[]>;
  historicalData?: Record<string, DailyTokenUsage[]>;
}

export interface GrowthMetrics {
  change7d: number | null;
  change30d: number | null;
  peakTokens: number;
  currentTokens: number;
  peakRatio: number | null;
  trend: "rising" | "falling" | "stable" | "unknown";
}

function calculateGrowthMetrics(dailyUsage: DailyTokenUsage[]): GrowthMetrics {
  if (dailyUsage.length < 2) {
    return {
      change7d: null,
      change30d: null,
      peakTokens: 0,
      currentTokens: 0,
      peakRatio: null,
      trend: "unknown",
    };
  }

  const recent = dailyUsage.slice(-7);
  const currentTokens =
    recent.reduce((sum, d) => sum + d.tokens, 0) / recent.length;

  const peakTokens = Math.max(...dailyUsage.map((d) => d.tokens));
  const peakRatio = peakTokens > 0 ? (currentTokens / peakTokens) * 100 : null;

  let change7d: number | null = null;
  if (dailyUsage.length >= 14) {
    const prev7 = dailyUsage.slice(-14, -7);
    const prevAvg = prev7.reduce((sum, d) => sum + d.tokens, 0) / prev7.length;
    if (prevAvg > 0) {
      change7d = ((currentTokens - prevAvg) / prevAvg) * 100;
    }
  }

  let change30d: number | null = null;
  if (dailyUsage.length >= 60) {
    const prev30 = dailyUsage.slice(-60, -30);
    const recent30 = dailyUsage.slice(-30);
    const prevAvg =
      prev30.reduce((sum, d) => sum + d.tokens, 0) / prev30.length;
    const recentAvg =
      recent30.reduce((sum, d) => sum + d.tokens, 0) / recent30.length;
    if (prevAvg > 0) {
      change30d = ((recentAvg - prevAvg) / prevAvg) * 100;
    }
  }

  let trend: "rising" | "falling" | "stable" | "unknown" = "unknown";
  if (change7d !== null) {
    if (change7d > 10) {
      trend = "rising";
    } else if (change7d < -10) {
      trend = "falling";
    } else {
      trend = "stable";
    }
  }

  return { change7d, change30d, peakTokens, currentTokens, peakRatio, trend };
}

function formatChangePercent(change: number | null): string {
  if (change === null) {
    return "-";
  }
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function getTrendEmoji(
  trend: "rising" | "falling" | "stable" | "unknown"
): string {
  switch (trend) {
    case "rising":
      return "📈";
    case "falling":
      return "📉";
    case "stable":
      return "➡️";
    default:
      return "-";
  }
}

function formatPrice(price: string): string {
  if (price === "-1") {
    return "Dynamic";
  }
  const num = Number.parseFloat(price);
  if (Number.isNaN(num) || num === 0) {
    return "Free";
  }
  // API pricing is per-token, convert to per-million tokens for readability
  // e.g., 0.0000005 per token = $0.50 per 1M tokens
  const perMillion = num * 1_000_000;
  if (perMillion >= 100) {
    return `$${perMillion.toFixed(0)}`;
  }
  if (perMillion >= 1) {
    const formatted = perMillion.toFixed(2);
    return `$${formatted.replace(TRAILING_ZERO_REGEX, "") || "0"}`;
  }
  if (perMillion >= 0.001) {
    const formatted = perMillion.toFixed(4);
    return `$${formatted.replace(TRAILING_ZERO_REGEX, "")}`;
  }
  return `$${perMillion.toPrecision(2)}`;
}

function extractProvider(modelId: string): string {
  const parts = modelId.split("/");
  return parts[0] || modelId;
}

function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000_000_000) {
    return `${(tokens / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(1)}B`;
  }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function buildTopModelsSection(
  top20: ModelActivity[],
  modelMap: Map<string, Model>
): string[] {
  const sections: string[] = [];
  sections.push("## Top 20 Popular Open-Weight Models");
  sections.push("");
  sections.push(
    "| Rank | Model | Provider | Total Tokens | Categories | Price (Input/Output) |"
  );
  sections.push(
    "|------|-------|----------|--------------|------------|---------------------|"
  );

  for (let index = 0; index < top20.length; index++) {
    const activity = top20[index];
    if (!activity) {
      continue;
    }
    const model = modelMap.get(activity.modelId);
    if (model) {
      const rank = index + 1;
      const provider = extractProvider(activity.modelId);
      const inputPrice = formatPrice(model.pricing.prompt);
      const outputPrice = formatPrice(model.pricing.completion);
      const priceDisplay = getPriceDisplay(inputPrice, outputPrice);
      const categories =
        activity.categories.length > 0
          ? activity.categories.slice(0, 2).join(", ")
          : "-";

      sections.push(
        `| ${rank} | ${model.name} | ${provider} | ${formatTokenCount(activity.totalTokens)} | ${categories} | ${priceDisplay} |`
      );
    }
  }

  sections.push("");
  return sections;
}

function getPriceDisplay(inputPrice: string, outputPrice: string): string {
  if (inputPrice === "Dynamic" || outputPrice === "Dynamic") {
    return "Dynamic";
  }
  return `${inputPrice}/${outputPrice}`;
}

function formatOptionalToken(tokens: number): string {
  return tokens > 0 ? formatTokenCount(tokens) : "-";
}

function getLicenseShort(license: string): string {
  if (license === "Fully Open") {
    return "✅ Open";
  }
  if (license === "Open with Restrictions") {
    return "⚠️ Restricted";
  }
  return "❓ Unknown";
}

function buildAllModelsRow(
  activity: ModelActivity,
  rank: number,
  modelMap: Map<string, Model>,
  licenses: Record<string, string>
): string | null {
  const model = modelMap.get(activity.modelId);
  if (!model) {
    return null;
  }

  const provider = extractProvider(activity.modelId);
  const inputPrice = formatPrice(model.pricing.prompt);
  const outputPrice = formatPrice(model.pricing.completion);
  const priceDisplay = getPriceDisplay(inputPrice, outputPrice);
  const total = formatOptionalToken(activity.totalTokens);
  const prompt = formatOptionalToken(activity.promptTokens);
  const completion = formatOptionalToken(activity.completionTokens);
  const reasoning = formatOptionalToken(activity.reasoningTokens);
  const license = licenses[model.id] || "Unknown";
  const licenseShort = getLicenseShort(license);

  return `| ${rank} | ${model.name} | ${provider} | ${total} | ${prompt} | ${completion} | ${reasoning} | ${licenseShort} | ${priceDisplay} |`;
}

function buildAllModelsSection(
  allSorted: ModelActivity[],
  modelMap: Map<string, Model>,
  licenses: Record<string, string>
): string[] {
  const sections: string[] = [];
  sections.push("## All Open-Weight Models by Token Usage");
  sections.push("");
  sections.push(
    "| Rank | Model | Provider | Total Tokens | Prompt | Completion | Reasoning | License | Price (In/Out) |"
  );
  sections.push(
    "|------|-------|----------|--------------|--------|------------|-----------|---------|----------------|"
  );

  for (let index = 0; index < allSorted.length; index++) {
    const activity = allSorted[index];
    if (!activity) {
      continue;
    }
    const row = buildAllModelsRow(activity, index + 1, modelMap, licenses);
    if (row) {
      sections.push(row);
    }
  }

  sections.push("");
  return sections;
}

function buildTrendsSection(
  top20: ModelActivity[],
  modelMap: Map<string, Model>,
  historicalData?: Record<string, DailyTokenUsage[]>
): string[] {
  if (!historicalData || Object.keys(historicalData).length === 0) {
    return [];
  }

  const sections: string[] = [];
  sections.push("## Usage Trends (Last 30 Days)");
  sections.push("");
  sections.push(
    "| Rank | Model | 7d Change | 30d Change | Current Avg | Peak | Peak % | Trend |"
  );
  sections.push(
    "|------|-------|-----------|------------|-------------|------|--------|-------|"
  );

  const modelsWithTrends = top20
    .filter((activity) => historicalData[activity.modelId])
    .slice(0, 20);

  for (let index = 0; index < modelsWithTrends.length; index++) {
    const activity = modelsWithTrends[index];
    if (!activity) {
      continue;
    }
    const model = modelMap.get(activity.modelId);
    const dailyUsage = historicalData[activity.modelId];

    if (model && dailyUsage && dailyUsage.length > 0) {
      const metrics = calculateGrowthMetrics(dailyUsage);
      const rank = index + 1;

      const peakRatioDisplay =
        metrics.peakRatio !== null ? `${metrics.peakRatio.toFixed(0)}%` : "-";
      sections.push(
        `| ${rank} | ${model.name} | ${formatChangePercent(metrics.change7d)} | ${formatChangePercent(metrics.change30d)} | ${formatTokenCount(Math.round(metrics.currentTokens))}/day | ${formatTokenCount(metrics.peakTokens)}/day | ${peakRatioDisplay} | ${getTrendEmoji(metrics.trend)} |`
      );
    }
  }

  sections.push("");
  return sections;
}

function buildPriceComparisonSection(models: Model[]): string[] {
  const sections: string[] = [];
  sections.push("## Price Comparison");
  sections.push("");
  sections.push("| Model | Input ($/1M) | Output ($/1M) | Context |");
  sections.push("|-------|--------------|---------------|---------|");

  for (const model of models) {
    const inputPrice = formatPrice(model.pricing.prompt);
    const outputPrice = formatPrice(model.pricing.completion);
    sections.push(
      `| ${model.name} | ${inputPrice} | ${outputPrice} | ${model.context_length} |`
    );
  }

  sections.push("");
  return sections;
}

function buildLicenseSection(
  models: Model[],
  licenses: Record<string, string>
): string[] {
  const sections: string[] = [];
  const fullyOpen: string[] = [];
  const restricted: string[] = [];
  const unknown: string[] = [];

  for (const model of models) {
    const license = licenses[model.id];
    if (license === "Fully Open") {
      fullyOpen.push(model.name);
    } else if (license === "Open with Restrictions") {
      restricted.push(model.name);
    } else {
      unknown.push(model.name);
    }
  }

  sections.push("## License Classification");
  sections.push("");
  sections.push("### Fully Open (Commercial OK)");
  if (fullyOpen.length === 0) {
    sections.push("- None");
  } else {
    for (const name of fullyOpen) {
      sections.push(`- ${name}`);
    }
  }
  sections.push("");

  sections.push("### Open with Restrictions");
  if (restricted.length === 0) {
    sections.push("- None");
  } else {
    for (const name of restricted) {
      sections.push(`- ${name}`);
    }
  }
  sections.push("");

  sections.push("### Unknown/Unclassified");
  if (unknown.length === 0) {
    sections.push("- None");
  } else {
    for (const name of unknown) {
      sections.push(`- ${name}`);
    }
  }
  sections.push("");

  return sections;
}

function buildAppUsageSection(
  models: Model[],
  apps: Record<string, string[]>
): string[] {
  const sections: string[] = [];
  sections.push("## App Usage");
  sections.push("## App Usage");
  sections.push("");
  sections.push("| Model | Used By |");
  sections.push("|-------|---------|");

  for (const model of models) {
    const modelApps = apps[model.id];
    if (modelApps && modelApps.length > 0) {
      const appsList = modelApps.join(", ");
      sections.push(`| ${model.name} | ${appsList} |`);
    }
  }

  sections.push("");
  return sections;
}

export function generateReport(data: ReportData): string {
  const { models, activities, licenses, apps, historicalData } = data;

  const sections: string[] = [];

  // Header
  sections.push("# OpenRouter Open-Weight Model Report");
  sections.push("");
  sections.push(`> Generated: ${getCurrentDate()}`);
  sections.push(`> Total Open-Weight Models: ${models.length}`);
  sections.push(
    `> Models with Usage Data: ${activities.filter((a) => a.totalTokens > 0).length}`
  );
  const historicalCount = historicalData
    ? Object.keys(historicalData).length
    : 0;
  if (historicalCount > 0) {
    sections.push(`> Models with Trend Data: ${historicalCount}`);
  }
  sections.push("> Data Source: OpenRouter.ai (Activity pages scraped)");
  sections.push("");

  const modelMap = new Map(models.map((m) => [m.id, m]));

  const sortedActivities = [...activities]
    .filter((a) => a.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens);

  const top20 = sortedActivities.slice(0, 20);
  sections.push(...buildTopModelsSection(top20, modelMap));

  // All Open-Weight Models by Usage
  const allSorted = [...activities]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 20);
  sections.push(...buildAllModelsSection(allSorted, modelMap, licenses));
  sections.push(...buildTrendsSection(top20, modelMap, historicalData));
  sections.push(...buildPriceComparisonSection(models));
  sections.push(...buildLicenseSection(models, licenses));
  sections.push(...buildAppUsageSection(models, apps));

  return sections.join("\n");
}
