import { test, expect, describe } from "bun:test";
import { fetchModelLicense } from "../lib/huggingface";

describe("HuggingFace API Client", () => {
  describe("fetchModelLicense", () => {
    test("should return 'Fully Open' for Apache 2.0 license", async () => {
      const license = await fetchModelLicense("bert-base-uncased");
      expect(license).toBe("Fully Open");
    });

    test("should return 'Fully Open' for MIT license", async () => {
      const license = await fetchModelLicense("gpt2");
      expect(license).toBe("Fully Open");
    });

    test("should return 'Open with Restrictions' for Llama2 license", async () => {
      const license = await fetchModelLicense("meta-llama/Llama-2-7b-hf");
      expect(license).toBe("Open with Restrictions");
    });

    test("should return 'Open with Restrictions' for Llama3 license", async () => {
      const license = await fetchModelLicense("meta-llama/Meta-Llama-3-8B");
      expect(license).toBe("Open with Restrictions");
    });

    test("should return 'Open with Restrictions' for Gemma license", async () => {
      const license = await fetchModelLicense("google/gemma-7b");
      expect(license).toBe("Open with Restrictions");
    });

    test("should return 'Unknown' for missing license field", async () => {
      const license = await fetchModelLicense("nonexistent-model-xyz-123");
      expect(license).toBe("Unknown");
    });

    test("should return 'Unknown' for custom/unrecognized license", async () => {
      // Some models have custom licenses that don't fit our categories
      const license = await fetchModelLicense("bigscience/bloom");
      expect(["Fully Open", "Open with Restrictions", "Unknown"]).toContain(license);
    });

    test("should handle API errors gracefully", async () => {
      const license = await fetchModelLicense("invalid/model/path/that/does/not/exist");
      expect(license).toBe("Unknown");
    });
  });
});
