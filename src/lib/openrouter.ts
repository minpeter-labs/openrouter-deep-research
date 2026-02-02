export interface Model {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
  };
  pricing: {
    prompt: string;
    completion: string;
  };
}

interface ModelsResponse {
  data: Model[];
}

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/models";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchModels(): Promise<Model[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENROUTER_API_URL);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ModelsResponse = await response.json();
      return data.data;
    } catch (error) {
      lastError = error as Error;

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(
    `Failed to fetch models after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
}

export function filterOpenWeightModels(models: Model[]): Model[] {
  return models.filter((model) => {
    return model.hugging_face_id && model.hugging_face_id !== "";
  });
}
