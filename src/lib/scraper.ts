import { chromium, type Browser } from "playwright";

export interface RankingEntry {
  modelId: string;
  modelName: string;
  weeklyTokens: string;
}

export interface ModelApps {
  modelId: string;
  apps: string[];
}

const RANKINGS_URL = "https://openrouter.ai/rankings";
const MODEL_BASE_URL = "https://openrouter.ai";
const RATE_LIMIT_DELAY_MS = 2000;

let lastRequestTime = 0;

async function rateLimitDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (lastRequestTime > 0 && elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function createBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function scrapeRankings(): Promise<RankingEntry[]> {
  let browser: Browser | null = null;
  
  try {
    await rateLimitDelay();
    browser = await createBrowser();
    const page = await browser.newPage();
    
    await page.goto(RANKINGS_URL, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(2000);
    
    const rankings: RankingEntry[] = await page.evaluate(() => {
      const results: { modelId: string; modelName: string; weeklyTokens: string }[] = [];
      const seenModels = new Set<string>();
      
      const singleSegmentExcluded = new Set([
        'docs', 'chat', 'rankings', 'apps', 'models', 'providers',
        'settings', 'compare', 'api', 'enterprise', 'careers', 'about',
        'privacy', 'terms', 'support', 'sdk', 'pricing', 'announcements',
        'partners', 'state-of-ai', 'works-with-openrouter'
      ]);
      
      const allLinks = document.querySelectorAll('a[href^="/"]');
      
      for (const link of Array.from(allLinks)) {
        const href = link.getAttribute('href') || '';
        
        const segments = href.split('/').filter(Boolean);
        if (segments.length !== 2) continue;
        
        const provider = segments[0];
        const model = segments[1];
        
        if (!provider || !model) continue;
        
        if (singleSegmentExcluded.has(provider) || singleSegmentExcluded.has(model)) {
          continue;
        }
        
        const modelId = `${provider}/${model}`;
        if (seenModels.has(modelId)) continue;
        
        const modelName = link.textContent?.trim() || '';
        if (!modelName || modelName.length < 2 || modelName.includes('/') || modelName === 'by') continue;
        
        let tokensText = '';
        let current = link.parentElement;
        for (let i = 0; i < 8 && current; i++) {
          const text = current.textContent || '';
          const tokenMatch = text.match(/(\d+(?:\.\d+)?[KMBT]?B?)\s*tokens/i);
          if (tokenMatch && tokenMatch[1]) {
            tokensText = tokenMatch[1];
            break;
          }
          current = current.parentElement;
        }
        
        if (tokensText) {
          seenModels.add(modelId);
          results.push({
            modelId,
            modelName,
            weeklyTokens: tokensText,
          });
        }
      }
      
      return results;
    });
    
    return rankings;
  } catch (error) {
    console.error("Error scraping rankings:", error);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

export async function scrapeModelApps(modelId: string): Promise<ModelApps> {
  let browser: Browser | null = null;
  
  try {
    await rateLimitDelay();
    browser = await createBrowser();
    const page = await browser.newPage();
    
    const appsUrl = `${MODEL_BASE_URL}/${modelId}/apps`;
    
    const response = await page.goto(appsUrl, { waitUntil: "networkidle", timeout: 15000 });
    
    if (!response || response.status() >= 400) {
      return { modelId, apps: [] };
    }
    
    await page.waitForTimeout(1000);
    
    const apps = await page.evaluate(() => {
      const appNames: string[] = [];
      const seenApps = new Set<string>();
      
      const appLinks = Array.from(document.querySelectorAll('a[href*="/apps?url="]'));
      
      for (const link of appLinks) {
        let text = '';
        
        const childNodes = Array.from(link.childNodes);
        for (const node of childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            const nodeText = node.textContent?.trim();
            if (nodeText) {
              text = nodeText;
              break;
            }
          }
        }
        
        if (!text) {
          const firstLine = link.textContent?.split('\n')[0]?.trim();
          if (firstLine) {
            text = firstLine;
          }
        }
        
        text = text.replace(/[^\w\s'-]/g, '').trim();
        
        if (text && text.length > 1 && !seenApps.has(text.toLowerCase())) {
          seenApps.add(text.toLowerCase());
          appNames.push(text);
        }
      }
      
      return appNames;
    });
    
    return { modelId, apps };
  } catch (error) {
    console.error(`Error scraping apps for ${modelId}:`, error);
    return { modelId, apps: [] };
  } finally {
    if (browser) await browser.close();
  }
}
