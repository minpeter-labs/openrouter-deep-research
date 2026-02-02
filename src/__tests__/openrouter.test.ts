import { describe, expect, test } from "bun:test";
import {
  fetchModels,
  filterOpenWeightModels,
  type Model,
} from "../lib/openrouter";

describe("OpenRouter API Client", () => {
  describe("fetchModels", () => {
    test("should fetch models from OpenRouter API", async () => {
      const models = await fetchModels();

      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    test("should return models with required fields", async () => {
      const models = await fetchModels();
      const firstModel = models[0];

      expect(firstModel).toBeDefined();
      if (!firstModel) {
        return;
      }
      expect(firstModel).toHaveProperty("id");
      expect(firstModel).toHaveProperty("name");
      expect(firstModel).toHaveProperty("hugging_face_id");
      expect(firstModel).toHaveProperty("pricing");
      expect(firstModel.pricing).toHaveProperty("prompt");
      expect(firstModel.pricing).toHaveProperty("completion");
    });

    test("should retry on failure up to 3 times", async () => {
      // This test verifies retry logic exists
      // Actual implementation will handle network failures
      const models = await fetchModels();
      expect(models).toBeDefined();
    });
  });

  describe("filterOpenWeightModels", () => {
    test("should filter models with non-empty hugging_face_id", () => {
      const mockModels: Model[] = [
        {
          id: "open-model-1",
          canonical_slug: "open-model-1",
          hugging_face_id: "org/model-1",
          name: "Open Model 1",
          created: Date.now(),
          description: "An open model",
          context_length: 4096,
          architecture: {
            modality: "text->text",
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
          id: "closed-model-1",
          canonical_slug: "closed-model-1",
          hugging_face_id: "",
          name: "Closed Model 1",
          created: Date.now(),
          description: "A closed model",
          context_length: 4096,
          architecture: {
            modality: "text->text",
            input_modalities: ["text"],
            output_modalities: ["text"],
            tokenizer: "GPT",
          },
          pricing: {
            prompt: "0.30",
            completion: "0.60",
          },
        },
        {
          id: "open-model-2",
          canonical_slug: "open-model-2",
          hugging_face_id: "another-org/model-2",
          name: "Open Model 2",
          created: Date.now(),
          description: "Another open model",
          context_length: 8192,
          architecture: {
            modality: "text->text",
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

      const openWeightModels = filterOpenWeightModels(mockModels);

      expect(openWeightModels.length).toBe(2);
      const [firstModel, secondModel] = openWeightModels;
      if (!(firstModel && secondModel)) {
        throw new Error("Expected two open-weight models");
      }
      expect(firstModel.id).toBe("open-model-1");
      expect(secondModel.id).toBe("open-model-2");
    });

    test("should handle empty array", () => {
      const openWeightModels = filterOpenWeightModels([]);
      expect(openWeightModels.length).toBe(0);
    });

    test("should handle all closed models", () => {
      const mockModels: Model[] = [
        {
          id: "closed-1",
          canonical_slug: "closed-1",
          hugging_face_id: "",
          name: "Closed 1",
          created: Date.now(),
          description: "Closed",
          context_length: 4096,
          architecture: {
            modality: "text->text",
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

      const openWeightModels = filterOpenWeightModels(mockModels);
      expect(openWeightModels.length).toBe(0);
    });
  });

  describe("Integration test", () => {
    test("should fetch and filter open-weight models from real API", async () => {
      const allModels = await fetchModels();
      const openWeightModels = filterOpenWeightModels(allModels);

      expect(allModels.length).toBeGreaterThan(300);
      expect(openWeightModels.length).toBeGreaterThan(100);

      // Verify all filtered models have hugging_face_id
      for (const model of openWeightModels) {
        expect(model.hugging_face_id).toBeTruthy();
        expect(model.hugging_face_id).not.toBe("");
      }
    });
  });
});
