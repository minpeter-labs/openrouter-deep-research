import type { Model } from "./openrouter";
import type { RankingEntry } from "./scraper";

export interface ReportData {
  models: Model[];
  rankings: RankingEntry[];
  licenses: Record<string, string>;
  apps: Record<string, string[]>;
}

function formatPrice(price: string): string {
  if (price === "-1") {
    return "Dynamic";
  }
  return `$${price}`;
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

export function generateReport(data: ReportData): string {
  const { models, rankings, licenses, apps } = data;
  
  const sections: string[] = [];

  // Header
  sections.push("# OpenRouter Open-Weight Model Report");
  sections.push("");
  sections.push(`> Generated: ${getCurrentDate()}`);
  sections.push(`> Total Open-Weight Models: ${models.length}`);
  sections.push("> Data Source: OpenRouter.ai");
  sections.push("");

  // Top 20 Popular Models
  sections.push("## Top 20 Popular Open-Weight Models");
  sections.push("");
  sections.push("| Rank | Model | Provider | Weekly Tokens | Price (Input/Output) |");
  sections.push("|------|-------|----------|---------------|---------------------|");

  const top20 = rankings.slice(0, 20);
  const modelMap = new Map(models.map(m => [m.id, m]));

  top20.forEach((ranking, index) => {
    const model = modelMap.get(ranking.modelId);
    if (model) {
      const rank = index + 1;
      const provider = extractProvider(ranking.modelId);
      const inputPrice = formatPrice(model.pricing.prompt);
      const outputPrice = formatPrice(model.pricing.completion);
      const priceDisplay = inputPrice === "Dynamic" || outputPrice === "Dynamic" 
        ? "Dynamic" 
        : `${inputPrice}/${outputPrice}`;

      sections.push(
        `| ${rank} | ${ranking.modelName} | ${provider} | ${ranking.weeklyTokens} | ${priceDisplay} |`
      );
    }
  });

  sections.push("");

  // Price Comparison
  sections.push("## Price Comparison");
  sections.push("");
  sections.push("| Model | Input ($/1M) | Output ($/1M) | Context |");
  sections.push("|-------|--------------|---------------|---------|");

  models.forEach(model => {
    const inputPrice = formatPrice(model.pricing.prompt);
    const outputPrice = formatPrice(model.pricing.completion);
    sections.push(
      `| ${model.name} | ${inputPrice} | ${outputPrice} | ${model.context_length} |`
    );
  });

  sections.push("");

  // License Classification
  sections.push("## License Classification");
  sections.push("");

  const fullyOpen: string[] = [];
  const restricted: string[] = [];
  const unknown: string[] = [];

  models.forEach(model => {
    const license = licenses[model.id] || "Unknown";
    const entry = `- ${model.name}`;

    if (license === "Fully Open") {
      fullyOpen.push(entry);
    } else if (license === "Open with Restrictions") {
      restricted.push(entry);
    } else {
      unknown.push(entry);
    }
  });

  if (fullyOpen.length > 0) {
    sections.push("### Fully Open (Commercial OK)");
    sections.push("");
    sections.push(...fullyOpen);
    sections.push("");
  }

  if (restricted.length > 0) {
    sections.push("### Open with Restrictions");
    sections.push("");
    sections.push(...restricted);
    sections.push("");
  }

  if (unknown.length > 0) {
    sections.push("### Unknown");
    sections.push("");
    sections.push(...unknown);
    sections.push("");
  }

  // App Usage
  sections.push("## App Usage");
  sections.push("");
  sections.push("| Model | Used By |");
  sections.push("|-------|---------|");

  models.forEach(model => {
    const modelApps = apps[model.id];
    if (modelApps && modelApps.length > 0) {
      const appsList = modelApps.join(", ");
      sections.push(`| ${model.name} | ${appsList} |`);
    }
  });

  sections.push("");

  return sections.join("\n");
}
