import type { Model } from "./openrouter";
import type { ModelActivity } from "./scraper";

const TRAILING_ZERO_REGEX = /\.?0+$/;

export interface ReportData {
  models: Model[];
  activities: ModelActivity[];
  licenses: Record<string, string>;
  apps: Record<string, string[]>;
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

export function generateReport(data: ReportData): string {
  const { models, activities, licenses, apps } = data;

  const lines: string[] = [];

  lines.push("# OpenRouter Open-Weight Models - Top 20");
  lines.push("");
  lines.push(`Generated: ${getCurrentDate()} | Source: OpenRouter.ai`);
  lines.push("");

  const modelMap = new Map(models.map((m) => [m.id, m]));

  const top20 = [...activities]
    .filter((a) => a.totalTokens > 0)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 20);

  lines.push(
    "| # | Model | Provider | Total | Prompt | Completion | Reasoning | Categories | License | Price | Apps |"
  );
  lines.push(
    "|---|-------|----------|-------|--------|------------|-----------|------------|---------|-------|------|"
  );

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
      modelApps && modelApps.length > 0
        ? modelApps.slice(0, 3).join(", ")
        : "-";

    lines.push(
      `| ${rank} | ${model.name} | ${provider} | ${total} | ${prompt} | ${completion} | ${reasoning} | ${categories} | ${license} | ${price} | ${appsDisplay} |`
    );
  }

  lines.push("");

  return lines.join("\n");
}
