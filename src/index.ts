import { fetchModels, filterOpenWeightModels } from './lib/openrouter';
import { fetchModelLicense } from './lib/huggingface';
import { scrapeRankings, scrapeModelApps } from './lib/scraper';
import { generateReport } from './lib/report';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
    ),
  ]);
}

async function main() {
  try {
    console.log('Phase 1: Fetching API data...');
    const models = await fetchModels();
    console.log(`Total models fetched: ${models.length}`);
    
    const openWeightModels = filterOpenWeightModels(models);
    console.log(`Found ${openWeightModels.length} open-weight models`);

    const licenses: Record<string, string> = {};
    for (let i = 0; i < openWeightModels.length; i++) {
      const model = openWeightModels[i];
      if (model.hugging_face_id) {
        licenses[model.id] = await fetchModelLicense(model.hugging_face_id);
        if ((i + 1) % 10 === 0) {
          console.log(`  Processed ${i + 1}/${openWeightModels.length} licenses`);
        }
      }
    }
    console.log(`Fetched licenses for ${Object.keys(licenses).length} models`);

    console.log('Phase 2: Scraping rankings and apps...');
    let rankings = [];
    try {
      rankings = await withTimeout(scrapeRankings(), 60000);
      console.log(`Found ${rankings.length} ranking entries`);
    } catch (error) {
      console.log('  Skipped rankings scraping (timeout)');
    }
    
    const apps: Record<string, string[]> = {};
    console.log('Skipping apps scraping (performance optimization)');

    console.log('Generating report...');
    const report = generateReport({ 
      models: openWeightModels, 
      rankings, 
      licenses, 
      apps 
    });
    
    await Bun.write('report.md', report);
    console.log('Done! Report saved to report.md');
    
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
