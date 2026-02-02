export type LicenseCategory = "Fully Open" | "Open with Restrictions" | "Unknown";

interface HFModelResponse {
  id: string;
  tags?: string[];
}

const FULLY_OPEN_LICENSES = ["apache-2.0", "mit", "bsd-3-clause", "cc-by-4.0"];
const RESTRICTED_LICENSES = ["llama2", "llama3", "gemma", "cc-by-nc-4.0"];

let lastRequestTime = 0;

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 500) {
    await new Promise(resolve => setTimeout(resolve, 500 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

export async function fetchModelLicense(huggingFaceId: string): Promise<LicenseCategory> {
  try {
    await rateLimit();

    const response = await fetch(`https://huggingface.co/api/models/${huggingFaceId}`);
    
    if (!response.ok) {
      return "Unknown";
    }

    const data: HFModelResponse = await response.json();

    if (!data.tags) {
      return "Unknown";
    }

    const licenseTag = data.tags.find(tag => tag.startsWith("license:"));
    
    if (!licenseTag) {
      return "Unknown";
    }

    const license = licenseTag.replace("license:", "").toLowerCase();

    if (FULLY_OPEN_LICENSES.includes(license)) {
      return "Fully Open";
    }

    if (RESTRICTED_LICENSES.includes(license)) {
      return "Open with Restrictions";
    }

    return "Unknown";
  } catch (error) {
    return "Unknown";
  }
}
