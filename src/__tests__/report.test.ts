import { expect, test } from "bun:test";
import type { Model } from "../lib/openrouter";
import {
  analyzeTrend,
  calculateMovingAverage,
  createSparkline,
  generateReport,
  type ReportData,
} from "../lib/report";
import type { DailyTokenUsage, ModelActivity } from "../lib/scraper";

const SPARKLINE_REGEX = /^[▁▂▃▄▅▆▇█]+$/;
const DIRECTION_REGEX = /^[↗→↘]$/;

test("generateReport should include header", () => {
  const mockData: ReportData = {
    models: [],
    activities: [],
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("# OpenRouter Open-Weight Models - Top 20");
  expect(report).toContain("Generated:");
  expect(report).toContain("Source: OpenRouter.ai");
});

test("generateReport should create unified table with all columns", () => {
  const mockModels: Model[] = [
    {
      id: "deepseek/deepseek-v3",
      canonical_slug: "deepseek/deepseek-v3",
      hugging_face_id: "deepseek-ai/DeepSeek-V3",
      name: "DeepSeek V3",
      created: 1_234_567_890,
      description: "Test model",
      context_length: 128_000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000003",
        completion: "0.0000012",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "deepseek/deepseek-v3",
      promptTokens: 16_200_000_000,
      completionTokens: 567_000_000,
      reasoningTokens: 75_400_000,
      totalTokens: 16_842_400_000,
      categories: ["Roleplay (#1)", "Academia (#4)"],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: { "deepseek/deepseek-v3": "Fully Open" },
    apps: { "deepseek/deepseek-v3": ["App1", "App2"] },
  };

  const report = generateReport(mockData);

  expect(report).toContain(
    "| # | Model | Provider | Total | Prompt | Completion | Reasoning | Categories | License | Price | Apps |"
  );
  expect(report).toContain("DeepSeek V3");
  expect(report).toContain("deepseek");
  expect(report).toContain("16.8B");
  expect(report).toContain("16.2B");
  expect(report).toContain("567.0M");
  expect(report).toContain("75.4M");
  expect(report).toContain("Roleplay (#1)");
  expect(report).toContain("Open");
  expect(report).toContain("$0.3/$1.2");
  expect(report).toContain("App1, App2");
});

test("generateReport should handle dynamic pricing (-1)", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "-1",
        completion: "-1",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "test/model",
      promptTokens: 100_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 100_000_000,
      categories: [],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("Dynamic");
});

test("generateReport should show license status in table", () => {
  const mockModels: Model[] = [
    {
      id: "test/open",
      canonical_slug: "test/open",
      hugging_face_id: "test/open",
      name: "Open Model",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000001",
        completion: "0.0000002",
      },
    },
    {
      id: "test/restricted",
      canonical_slug: "test/restricted",
      hugging_face_id: "test/restricted",
      name: "Restricted Model",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000001",
        completion: "0.0000002",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "test/open",
      promptTokens: 200_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 200_000_000,
      categories: [],
    },
    {
      modelId: "test/restricted",
      promptTokens: 100_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 100_000_000,
      categories: [],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {
      "test/open": "Fully Open",
      "test/restricted": "Open with Restrictions",
    },
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("Open Model");
  expect(report).toContain("| Open |");
  expect(report).toContain("Restricted Model");
  expect(report).toContain("| Restricted |");
});

test("generateReport should show apps in table", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000001",
        completion: "0.0000002",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "test/model",
      promptTokens: 100_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 100_000_000,
      categories: [],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {},
    apps: {
      "test/model": ["App1", "App2", "App3"],
    },
  };

  const report = generateReport(mockData);

  expect(report).toContain("App1, App2, App3");
});

test("generateReport should handle empty data gracefully", () => {
  const mockData: ReportData = {
    models: [],
    activities: [],
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("# OpenRouter Open-Weight Models - Top 20");
  expect(report).toContain("| # | Model |");
  expect(report).not.toContain("undefined");
  expect(report).not.toContain("null");
});

test("generateReport should limit to top 20", () => {
  const mockModels: Model[] = Array.from({ length: 30 }, (_, i) => ({
    id: `test/model-${i}`,
    canonical_slug: `test/model-${i}`,
    hugging_face_id: `test/model-${i}`,
    name: `Model ${i}`,
    created: 1_234_567_890,
    description: "Test",
    context_length: 8000,
    architecture: {
      modality: "text",
      input_modalities: ["text"],
      output_modalities: ["text"],
      tokenizer: "GPT",
    },
    pricing: {
      prompt: "0.0000001",
      completion: "0.0000002",
    },
  }));

  const mockActivities: ModelActivity[] = Array.from(
    { length: 30 },
    (_, i) => ({
      modelId: `test/model-${i}`,
      promptTokens: (100 - i) * 1_000_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: (100 - i) * 1_000_000_000,
      categories: [],
    })
  );

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("| 20 |");
  expect(report).not.toContain("| 21 |");
});

test("generateReport should only show models with activity data", () => {
  const mockModels: Model[] = [
    {
      id: "test/model-1",
      canonical_slug: "test/model-1",
      hugging_face_id: "test/model-1",
      name: "Model 1",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000001",
        completion: "0.0000002",
      },
    },
    {
      id: "test/model-2",
      canonical_slug: "test/model-2",
      hugging_face_id: "test/model-2",
      name: "Model 2",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.00000015",
        completion: "0.00000025",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "test/model-1",
      promptTokens: 100_000_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 100_000_000_000,
      categories: [],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("Model 1");
  expect(report).not.toContain("Model 2");
});

test("generateReport should show dash for missing optional data", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000001",
        completion: "0.0000002",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "test/model",
      promptTokens: 100_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 100_000_000,
      categories: [],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  const lines = report.split("\n");
  const dataRow = lines.find((line) => line.includes("Test Model"));
  expect(dataRow).toBeDefined();
  expect(dataRow).toContain("| - |");
});

test("generateReport should truncate apps to 3", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1_234_567_890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000001",
        completion: "0.0000002",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "test/model",
      promptTokens: 100_000_000,
      completionTokens: 0,
      reasoningTokens: 0,
      totalTokens: 100_000_000,
      categories: [],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: {},
    apps: {
      "test/model": ["App1", "App2", "App3", "App4", "App5"],
    },
  };

  const report = generateReport(mockData);

  expect(report).toContain("App1, App2, App3");
  expect(report).not.toContain("App4");
  expect(report).not.toContain("App5");
});

test("createSparkline should generate sparkline for normal data", () => {
  const values = [10, 20, 15, 30, 25, 35, 40];
  const sparkline = createSparkline(values);

  expect(sparkline).toBeDefined();
  expect(sparkline.length).toBe(7);
  expect(sparkline).toMatch(SPARKLINE_REGEX);
});

test("createSparkline should handle empty array", () => {
  const sparkline = createSparkline([]);

  expect(sparkline).toBe("");
});

test("createSparkline should handle single value", () => {
  const sparkline = createSparkline([42]);

  expect(sparkline).toBeDefined();
  expect(sparkline.length).toBe(1);
  expect(sparkline).toMatch(SPARKLINE_REGEX);
});

test("createSparkline should handle all same values", () => {
  const values = [5, 5, 5, 5, 5];
  const sparkline = createSparkline(values);

  expect(sparkline).toBeDefined();
  expect(sparkline.length).toBe(5);
  expect(sparkline).toMatch(SPARKLINE_REGEX);
});

test("calculateMovingAverage should calculate correctly", () => {
  const values = [1, 2, 3, 4, 5];
  const ma = calculateMovingAverage(values, 3);

  expect(ma.length).toBe(3);
  expect(ma[0]).toBe(2);
  expect(ma[1]).toBe(3);
  expect(ma[2]).toBe(4);
});

test("calculateMovingAverage should return empty for insufficient data", () => {
  const values = [1, 2, 3];
  const ma = calculateMovingAverage(values, 5);

  expect(ma.length).toBe(0);
});

test("analyzeTrend should analyze trend with sufficient data", () => {
  const dailyUsage: DailyTokenUsage[] = Array.from({ length: 35 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    tokens: 1_000_000 + i * 50_000,
  }));

  const trend = analyzeTrend(dailyUsage);

  expect(trend.sparkline).toBeDefined();
  expect(trend.sparkline.length).toBeGreaterThan(0);
  expect(trend.direction).toMatch(DIRECTION_REGEX);
  expect(trend.changePercent).toBeDefined();
  expect(trend.ma7).toBeGreaterThan(0);
  expect(trend.ma30).toBeGreaterThan(0);
});

test("analyzeTrend should handle insufficient data", () => {
  const dailyUsage: DailyTokenUsage[] = Array.from({ length: 5 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    tokens: 1_000_000,
  }));

  const trend = analyzeTrend(dailyUsage);

  expect(trend.sparkline).toBeDefined();
  expect(trend.direction).toBe("→");
  expect(trend.ma7).toBe(1_000_000);
  expect(trend.ma30).toBe(1_000_000);
});

test("analyzeTrend should handle empty data", () => {
  const trend = analyzeTrend([]);

  expect(trend.sparkline).toBe("");
  expect(trend.direction).toBe("→");
  expect(trend.changePercent).toBe(0);
  expect(trend.ma7).toBe(0);
  expect(trend.ma30).toBe(0);
});

test("generateReport should include trend columns with historicalData", () => {
  const mockModels: Model[] = [
    {
      id: "deepseek/deepseek-v3",
      canonical_slug: "deepseek/deepseek-v3",
      hugging_face_id: "deepseek-ai/DeepSeek-V3",
      name: "DeepSeek V3",
      created: 1_234_567_890,
      description: "Test model",
      context_length: 128_000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000003",
        completion: "0.0000012",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "deepseek/deepseek-v3",
      promptTokens: 16_200_000_000,
      completionTokens: 567_000_000,
      reasoningTokens: 75_400_000,
      totalTokens: 16_842_400_000,
      categories: ["Roleplay (#1)", "Academia (#4)"],
    },
  ];

  const mockHistoricalData: Record<string, DailyTokenUsage[]> = {
    "deepseek/deepseek-v3": Array.from({ length: 35 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, "0")}`,
      tokens: 1_000_000 + i * 50_000,
    })),
  };

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: { "deepseek/deepseek-v3": "Fully Open" },
    apps: {},
    historicalData: mockHistoricalData,
  };

  const report = generateReport(mockData);

  expect(report).toContain(
    "| # | Model | Provider | Total | Trend | Momentum | License | Price |"
  );
  expect(report).toContain("Trend");
  expect(report).toContain("Momentum");
  expect(report).not.toContain("Prompt");
  expect(report).not.toContain("Completion");
});

test("generateReport should maintain original format without historicalData", () => {
  const mockModels: Model[] = [
    {
      id: "deepseek/deepseek-v3",
      canonical_slug: "deepseek/deepseek-v3",
      hugging_face_id: "deepseek-ai/DeepSeek-V3",
      name: "DeepSeek V3",
      created: 1_234_567_890,
      description: "Test model",
      context_length: 128_000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.0000003",
        completion: "0.0000012",
      },
    },
  ];

  const mockActivities: ModelActivity[] = [
    {
      modelId: "deepseek/deepseek-v3",
      promptTokens: 16_200_000_000,
      completionTokens: 567_000_000,
      reasoningTokens: 75_400_000,
      totalTokens: 16_842_400_000,
      categories: ["Roleplay (#1)", "Academia (#4)"],
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    activities: mockActivities,
    licenses: { "deepseek/deepseek-v3": "Fully Open" },
    apps: { "deepseek/deepseek-v3": ["App1", "App2"] },
  };

  const report = generateReport(mockData);

  expect(report).toContain(
    "| # | Model | Provider | Total | Prompt | Completion | Reasoning | Categories | License | Price | Apps |"
  );
  expect(report).toContain("Prompt");
  expect(report).toContain("Completion");
  expect(report).toContain("Reasoning");
  expect(report).toContain("Categories");
  expect(report).not.toContain("Trend | Momentum");
  expect(report).not.toContain("Momentum");
});
