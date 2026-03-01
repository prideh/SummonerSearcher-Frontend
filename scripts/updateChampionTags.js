import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log('Fetching latest League of Legends versions...');
    // Fetch the latest patch version array
    const versionsRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions = await versionsRes.json();
    const latestVersion = versions[0]; // e.g. "16.4.1"
    
    console.log(`Latest version is ${latestVersion}. Fetching champion data...`);
    
    // Fetch the champion data for that specific version
    const champsRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    const data = await champsRes.json();
    const champions = data.data;
    
    const result = {};
    for (const key in champions) {
      const champ = champions[key];
      // Map by ID (which is usually what Match API's participant.championName returns, e.g. "MonkeyKing")
      result[champ.id] = champ.tags;
      // Also map by display name as a fallback (e.g. "Wukong", "Nunu & Willump")
      if (champ.id !== champ.name) {
          result[champ.name] = champ.tags;
      }
    }
    
    const fileContent = `// Auto-generated from Riot Data Dragon ${latestVersion}
// Tags usually are: Assassin, Fighter, Mage, Marksman, Support, Tank
export const CHAMPION_TAGS: Record<string, string[]> = ${JSON.stringify(result, null, 2)};

export const getChampionTags = (championName: string): string[] => {
  return CHAMPION_TAGS[championName] || [];
};

export const hasTag = (championName: string, tag: string): boolean => {
  return getChampionTags(championName).includes(tag);
};
`;

    // Save it to src/utils/championTags.ts
    const targetPath = path.join(__dirname, '..', 'src', 'utils', 'championTags.ts');
    fs.writeFileSync(targetPath, fileContent);
    console.log(`Successfully generated championTags.ts for patch ${latestVersion}`);
  } catch (err) {
    console.error('Error generating tags:', err);
    process.exit(1);
  }
}

main();
