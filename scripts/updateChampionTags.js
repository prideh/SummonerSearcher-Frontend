import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetPath = path.join(__dirname, '..', 'src', 'utils', 'championTags.ts');

  try {
    console.log('Fetching latest League of Legends versions...');
    // Fetch the latest patch version array
    const versionsRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    if (!versionsRes.ok) {
      throw new Error(`Failed to fetch versions.json (HTTP ${versionsRes.status})`);
    }
    const versions = await versionsRes.json();
    const latestVersion = versions[0]; // e.g. "16.4.1"
    
    console.log(`Latest version is ${latestVersion}. Fetching champion data...`);
    
    // Fetch the champion data for that specific version
    const champsRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/en_US/champion.json`);
    if (!champsRes.ok) {
      throw new Error(`Failed to fetch champion.json (HTTP ${champsRes.status})`);
    }
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
export const COMMITTED_DDRAGON_VERSION = '${latestVersion}';

export const CHAMPION_TAGS: Record<string, string[]> = ${JSON.stringify(result, null, 2)};

let runtimeChampionTags: Record<string, string[]> | null = null;

/**
 * Replaces or clears the runtime champion tag map (used by Data Dragon runtime sync and tests).
 */
export const setRuntimeChampionTags = (tagsMap: Record<string, string[]> | null): void => {
  runtimeChampionTags = tagsMap;
};

/**
 * Builds and stores a runtime champion tag map from Data Dragon's \`champion.json\` data payload.
 */
export const syncChampionTagsFromDDragon = (
  champions: Record<string, { id: string; name: string; tags?: string[] }>
): Record<string, string[]> => {
  const nextTags: Record<string, string[]> = {};
  for (const key in champions) {
    const champ = champions[key];
    if (!champ || !Array.isArray(champ.tags)) continue;
    nextTags[champ.id] = champ.tags;
    if (champ.name && champ.id !== champ.name) {
      nextTags[champ.name] = champ.tags;
    }
  }
  runtimeChampionTags = nextTags;
  return nextTags;
};

export const getChampionTags = (championName: string): string[] => {
  if (runtimeChampionTags && runtimeChampionTags[championName]) {
    return runtimeChampionTags[championName];
  }
  return CHAMPION_TAGS[championName] || [];
};

export const hasTag = (championName: string, tag: string): boolean => {
  return getChampionTags(championName).includes(tag);
};
`;

    // Save it to src/utils/championTags.ts
    fs.writeFileSync(targetPath, fileContent);
    console.log(`Successfully generated championTags.ts for patch ${latestVersion}`);
  } catch (err) {
    if (fs.existsSync(targetPath)) {
      console.warn(
        `Warning: Could not reach Data Dragon to refresh championTags.ts (${err instanceof Error ? err.message : String(err)}). Falling back to committed ${targetPath}.`
      );
      return;
    }
    console.error('Error generating tags and no fallback file exists:', err);
    process.exit(1);
  }
}

main();
