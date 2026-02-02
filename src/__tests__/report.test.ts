import { test, expect } from "bun:test";
import { generateReport, type ReportData } from "../lib/report";
import type { Model } from "../lib/openrouter";
import type { RankingEntry } from "../lib/scraper";

test("generateReport should include header with metadata", () => {
  const mockData: ReportData = {
    models: [],
    rankings: [],
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("# OpenRouter Open-Weight Model Report");
  expect(report).toContain("> Generated:");
  expect(report).toContain("> Total Open-Weight Models: 0");
  expect(report).toContain("> Data Source: OpenRouter.ai");
});

test("generateReport should create Top 20 Popular Models table", () => {
  const mockModels: Model[] = [
    {
      id: "deepseek/deepseek-v3",
      canonical_slug: "deepseek/deepseek-v3",
      hugging_face_id: "deepseek-ai/DeepSeek-V3",
      name: "DeepSeek V3",
      created: 1234567890,
      description: "Test model",
      context_length: 128000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.30",
        completion: "1.20",
      },
    },
  ];

  const mockRankings: RankingEntry[] = [
    {
      modelId: "deepseek/deepseek-v3",
      modelName: "DeepSeek V3",
      weeklyTokens: "508B",
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    rankings: mockRankings,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("## Top 20 Popular Open-Weight Models");
  expect(report).toContain("| Rank | Model | Provider | Weekly Tokens | Price (Input/Output) |");
  expect(report).toContain("| 1 | DeepSeek V3 | deepseek | 508B | $0.30/$1.20 |");
});

test("generateReport should handle dynamic pricing (-1)", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1234567890,
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

  const mockRankings: RankingEntry[] = [
    {
      modelId: "test/model",
      modelName: "Test Model",
      weeklyTokens: "100M",
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    rankings: mockRankings,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("Dynamic");
});

test("generateReport should create Price Comparison table", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1234567890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.10",
        completion: "0.20",
      },
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    rankings: [],
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("## Price Comparison");
  expect(report).toContain("| Model | Input ($/1M) | Output ($/1M) | Context |");
  expect(report).toContain("| Test Model | $0.10 | $0.20 | 8000 |");
});

test("generateReport should create License Classification section", () => {
  const mockModels: Model[] = [
    {
      id: "test/open",
      canonical_slug: "test/open",
      hugging_face_id: "test/open",
      name: "Open Model",
      created: 1234567890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.10",
        completion: "0.20",
      },
    },
    {
      id: "test/restricted",
      canonical_slug: "test/restricted",
      hugging_face_id: "test/restricted",
      name: "Restricted Model",
      created: 1234567890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.10",
        completion: "0.20",
      },
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    rankings: [],
    licenses: {
      "test/open": "Fully Open",
      "test/restricted": "Open with Restrictions",
    },
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("## License Classification");
  expect(report).toContain("### Fully Open (Commercial OK)");
  expect(report).toContain("- Open Model");
  expect(report).toContain("### Open with Restrictions");
  expect(report).toContain("- Restricted Model");
});

test("generateReport should create App Usage table", () => {
  const mockModels: Model[] = [
    {
      id: "test/model",
      canonical_slug: "test/model",
      hugging_face_id: "test/model",
      name: "Test Model",
      created: 1234567890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.10",
        completion: "0.20",
      },
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    rankings: [],
    licenses: {},
    apps: {
      "test/model": ["App1", "App2", "App3"],
    },
  };

  const report = generateReport(mockData);

  expect(report).toContain("## App Usage");
  expect(report).toContain("| Model | Used By |");
  expect(report).toContain("| Test Model | App1, App2, App3 |");
});

test("generateReport should handle empty data gracefully", () => {
  const mockData: ReportData = {
    models: [],
    rankings: [],
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("# OpenRouter Open-Weight Model Report");
  expect(report).toContain("## Top 20 Popular Open-Weight Models");
  expect(report).toContain("## Price Comparison");
  expect(report).toContain("## License Classification");
  expect(report).toContain("## App Usage");
  expect(report).not.toContain("undefined");
  expect(report).not.toContain("null");
});

test("generateReport should limit rankings to top 20", () => {
  const mockModels: Model[] = Array.from({ length: 30 }, (_, i) => ({
    id: `test/model-${i}`,
    canonical_slug: `test/model-${i}`,
    hugging_face_id: `test/model-${i}`,
    name: `Model ${i}`,
    created: 1234567890,
    description: "Test",
    context_length: 8000,
    architecture: {
      modality: "text",
      input_modalities: ["text"],
      output_modalities: ["text"],
      tokenizer: "GPT",
    },
    pricing: {
      prompt: "0.10",
      completion: "0.20",
    },
  }));

  const mockRankings: RankingEntry[] = Array.from({ length: 30 }, (_, i) => ({
    modelId: `test/model-${i}`,
    modelName: `Model ${i}`,
    weeklyTokens: `${100 - i}B`,
  }));

  const mockData: ReportData = {
    models: mockModels,
    rankings: mockRankings,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("| 20 |");
  expect(report).not.toContain("| 21 |");
});

test("generateReport should handle models not in rankings", () => {
  const mockModels: Model[] = [
    {
      id: "test/model-1",
      canonical_slug: "test/model-1",
      hugging_face_id: "test/model-1",
      name: "Model 1",
      created: 1234567890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.10",
        completion: "0.20",
      },
    },
    {
      id: "test/model-2",
      canonical_slug: "test/model-2",
      hugging_face_id: "test/model-2",
      name: "Model 2",
      created: 1234567890,
      description: "Test",
      context_length: 8000,
      architecture: {
        modality: "text",
        input_modalities: ["text"],
        output_modalities: ["text"],
        tokenizer: "GPT",
      },
      pricing: {
        prompt: "0.15",
        completion: "0.25",
      },
    },
  ];

  const mockRankings: RankingEntry[] = [
    {
      modelId: "test/model-1",
      modelName: "Model 1",
      weeklyTokens: "100B",
    },
  ];

  const mockData: ReportData = {
    models: mockModels,
    rankings: mockRankings,
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("Model 1");
  expect(report).toContain("Model 2");
  expect(report).toContain("## Price Comparison");
});
