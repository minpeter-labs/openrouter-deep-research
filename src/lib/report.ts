import type { Model } from "./openrouter";
import type { DailyTokenUsage, ModelActivity } from "./scraper";

const TRAILING_ZERO_REGEX = /\.?0+$/;
const SPARKLINE_BARS = "▁▂▃▄▅▆▇█";

export interface TrendAnalysis {
  sparkline: string;
  direction: string;
  changePercent: number;
  ma7: number;
  ma30: number;
}

export interface ReportData {
  models: Model[];
  activities: ModelActivity[];
  licenses: Record<string, string>;
  apps: Record<string, string[]>;
  historicalData?: Record<string, DailyTokenUsage[]>;
}

function formatPrice(price: string): string {
  if (price === "-1") {
    return "Dynamic";
  }
  const num = Number.parseFloat(price);
  if (Number.isNaN(num) || num === 0) {
    return "Free";
  }
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

function formatOptionalToken(tokens: number): string {
  return tokens > 0 ? formatTokenCount(tokens) : "-";
}

function getLicenseShort(license: string): string {
  if (license === "Fully Open") {
    return "Open";
  }
  if (license === "Open with Restrictions") {
    return "Restricted";
  }
  return "Unknown";
}

function getPriceDisplay(inputPrice: string, outputPrice: string): string {
  if (inputPrice === "Dynamic" || outputPrice === "Dynamic") {
    return "Dynamic";
  }
  if (inputPrice === "Free" && outputPrice === "Free") {
    return "Free";
  }
  return `${inputPrice}/${outputPrice}`;
}

export function createSparkline(values: number[], length = 7): string {
  if (values.length === 0) {
    return "";
  }

  const slice = values.slice(-length);
  if (slice.length === 0) {
    return "";
  }

  const min = Math.min(...slice);
  const max = Math.max(...slice);
  const range = max - min;

  return slice
    .map((value) => {
      if (range === 0) {
        return SPARKLINE_BARS.at(4) ?? "▅";
      }
      const normalized = (value - min) / range;
      const index = Math.floor(normalized * (SPARKLINE_BARS.length - 1));
      const clampedIndex = Math.max(
        0,
        Math.min(index, SPARKLINE_BARS.length - 1)
      );
      return SPARKLINE_BARS.at(clampedIndex) ?? "▅";
    })
    .join("");
}

export function calculateMovingAverage(
  values: number[],
  window: number
): number[] {
  if (values.length < window) {
    return [];
  }

  const result: number[] = [];
  let sum = 0;

  for (let i = 0; i < window; i++) {
    const val = values.at(i);
    if (val !== undefined) {
      sum += val;
    }
  }
  result.push(sum / window);

  for (let i = window; i < values.length; i++) {
    const oldVal = values.at(i - window);
    const newVal = values.at(i);
    if (oldVal !== undefined && newVal !== undefined) {
      sum = sum - oldVal + newVal;
      result.push(sum / window);
    }
  }

  return result;
}

export function analyzeTrend(dailyUsage: DailyTokenUsage[]): TrendAnalysis {
  if (dailyUsage.length === 0) {
    return {
      sparkline: "",
      direction: "→",
      changePercent: 0,
      ma7: 0,
      ma30: 0,
    };
  }

  const values = dailyUsage.map((d) => d.tokens);
  const sparkline = createSparkline(values);

  const shortWindow = Math.min(7, values.length);
  const longWindow = Math.min(30, values.length);
  const ma7 = calculateMovingAverage(values, shortWindow);
  const ma30 = calculateMovingAverage(values, longWindow);

  const ma7Latest = ma7.length > 0 ? (ma7.at(-1) ?? 0) : 0;
  const ma30Latest = ma30.length > 0 ? (ma30.at(-1) ?? 0) : 0;

  let changePercent = 0;
  const comparisonWindow = Math.floor(values.length / 2);
  if (comparisonWindow >= 1) {
    const recentSlice = values.slice(-comparisonWindow);
    const previousSlice = values.slice(0, comparisonWindow);
    const recentAvg =
      recentSlice.reduce((sum, value) => sum + value, 0) / recentSlice.length;
    const prevAvg =
      previousSlice.reduce((sum, value) => sum + value, 0) /
      previousSlice.length;
    if (prevAvg > 0) {
      changePercent = ((recentAvg - prevAvg) / prevAvg) * 100;
    }
  }

  let direction = "→";
  if (changePercent > 5) {
    direction = "↗";
  }
  if (changePercent < -5) {
    direction = "↘";
  }

  return {
    sparkline,
    direction,
    changePercent: Math.round(changePercent),
    ma7: ma7Latest,
    ma30: ma30Latest,
  };
}

function getYesterdayTokens(dailyUsage: DailyTokenUsage[] | undefined): number {
  if (!dailyUsage || dailyUsage.length === 0) {
    return 0;
  }
  return dailyUsage.at(-1)?.tokens ?? 0;
}

function getTrendDisplay(trend: TrendAnalysis): string {
  const sign = trend.changePercent > 0 ? "+" : "";
  return `${trend.sparkline} ${trend.direction}${sign}${trend.changePercent}%`;
}

function getMomentumIndicator(trend: TrendAnalysis): string {
  if (trend.ma30 <= 0) {
    return "→";
  }

  const ratio = trend.ma7 / trend.ma30;

  if (ratio > 1.5) {
    return "🔥";
  }
  if (ratio > 1.1) {
    return "📈";
  }
  if (ratio >= 0.9 && ratio <= 1.1) {
    return "→";
  }
  if (ratio > 0.5) {
    return "📉";
  }
  return "⚠️";
}

function buildTrendTableRow(
  rank: number,
  model: Model,
  activity: ModelActivity,
  licenses: Record<string, string>,
  historicalData: Record<string, DailyTokenUsage[]> | undefined
): string {
  const provider = extractProvider(activity.modelId);
  const license = getLicenseShort(licenses[model.id] || "Unknown");
  const inputPrice = formatPrice(model.pricing.prompt);
  const outputPrice = formatPrice(model.pricing.completion);
  const price = getPriceDisplay(inputPrice, outputPrice);

  const dailyUsage = historicalData?.[activity.modelId];
  let trendDisplay = "-";
  let momentumDisplay = "-";
  let totalTokens = 0;

  if (dailyUsage && dailyUsage.length > 0) {
    const trend = analyzeTrend(dailyUsage);
    trendDisplay = getTrendDisplay(trend);
    momentumDisplay = getMomentumIndicator(trend);
    totalTokens = getYesterdayTokens(dailyUsage);
  }

  const total = formatTokenCount(totalTokens);
  return `| ${rank} | ${model.name} | ${provider} | ${total} | ${trendDisplay} | ${momentumDisplay} | ${license} | ${price} |`;
}

function buildOriginalTableRow(
  rank: number,
  model: Model,
  activity: ModelActivity,
  licenses: Record<string, string>,
  apps: Record<string, string[]>
): string {
  const provider = extractProvider(activity.modelId);
  const total = formatTokenCount(activity.totalTokens);
  const prompt = formatOptionalToken(activity.promptTokens);
  const completion = formatOptionalToken(activity.completionTokens);
  const reasoning = formatOptionalToken(activity.reasoningTokens);
  const categories =
    activity.categories.length > 0
      ? activity.categories.slice(0, 2).join(", ")
      : "-";
  const license = getLicenseShort(licenses[model.id] || "Unknown");
  const inputPrice = formatPrice(model.pricing.prompt);
  const outputPrice = formatPrice(model.pricing.completion);
  const price = getPriceDisplay(inputPrice, outputPrice);
  const modelApps = apps[model.id];
  const appsDisplay =
    modelApps && modelApps.length > 0 ? modelApps.slice(0, 3).join(", ") : "-";

  return `| ${rank} | ${model.name} | ${provider} | ${total} | ${prompt} | ${completion} | ${reasoning} | ${categories} | ${license} | ${price} | ${appsDisplay} |`;
}

export function generateReport(data: ReportData): string {
  const { models, activities, licenses, apps, historicalData } = data;

  const lines: string[] = [];

  lines.push("# OpenRouter Open-Weight Models - Top 20");
  lines.push("");
  lines.push(`Generated: ${getCurrentDate()} | Source: OpenRouter.ai`);
  lines.push("");

  const modelMap = new Map(models.map((m) => [m.id, m]));

  const hasHistoricalData =
    historicalData && Object.keys(historicalData).length > 0;

  const historicalTop = hasHistoricalData
    ? [...activities]
        .map((activity) => {
          const tokens = getYesterdayTokens(historicalData?.[activity.modelId]);
          return { activity, tokens };
        })
        .filter((entry) => entry.tokens > 0)
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 20)
        .map((entry) => entry.activity)
    : [];

  const top20 =
    historicalTop.length > 0
      ? historicalTop
      : [...activities]
          .filter((a) => a.totalTokens > 0)
          .sort((a, b) => b.totalTokens - a.totalTokens)
          .slice(0, 20);

  if (hasHistoricalData) {
    lines.push(
      "| # | Model | Provider | Total | Trend | Momentum | License | Price |"
    );
    lines.push(
      "|---|-------|----------|-------|----------|----------|---------|-------|"
    );
  } else {
    lines.push(
      "| # | Model | Provider | Total | Prompt | Completion | Reasoning | Categories | License | Price | Apps |"
    );
    lines.push(
      "|---|-------|----------|-------|--------|------------|-----------|------------|---------|-------|------|"
    );
  }

  for (let i = 0; i < top20.length; i++) {
    const activity = top20[i];
    if (!activity) {
      continue;
    }

    const model = modelMap.get(activity.modelId);
    if (!model) {
      continue;
    }

    const rank = i + 1;

    if (hasHistoricalData) {
      lines.push(
        buildTrendTableRow(rank, model, activity, licenses, historicalData)
      );
    } else {
      lines.push(buildOriginalTableRow(rank, model, activity, licenses, apps));
    }
  }

  lines.push("");

  return lines.join("\n");
}
