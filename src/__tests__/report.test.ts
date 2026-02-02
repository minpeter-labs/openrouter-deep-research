import { expect, test } from "bun:test";
import type { Model } from "../lib/openrouter";
import { generateReport, type ReportData } from "../lib/report";
import type { ModelActivity } from "../lib/scraper";

test("generateReport should include header with metadata", () => {
  const mockData: ReportData = {
    models: [],
    activities: [],
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
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("## Top 20 Popular Open-Weight Models");
  expect(report).toContain(
    "| Rank | Model | Provider | Total Tokens | Categories | Price (Input/Output) |"
  );
  expect(report).toContain(
    "| 1 | DeepSeek V3 | deepseek | 16.8B | Roleplay (#1), Academia (#4) | $0.3/$1.2 |"
  );
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

test("generateReport should create Price Comparison table", () => {
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

  const mockData: ReportData = {
    models: mockModels,
    activities: [],
    licenses: {},
    apps: {},
  };

  const report = generateReport(mockData);

  expect(report).toContain("## Price Comparison");
  expect(report).toContain(
    "| Model | Input ($/1M) | Output ($/1M) | Context |"
  );
  expect(report).toContain("| Test Model | $0.1 | $0.2 | 8000 |");
});

test("generateReport should create License Classification section", () => {
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

  const mockData: ReportData = {
    models: mockModels,
    activities: [],
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

  const mockData: ReportData = {
    models: mockModels,
    activities: [],
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
    activities: [],
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

test("generateReport should handle models not in activities", () => {
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
  expect(report).toContain("Model 2");
  expect(report).toContain("## Price Comparison");
});
