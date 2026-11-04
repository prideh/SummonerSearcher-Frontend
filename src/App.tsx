import { useEffect } from 'react';
import NavigationLayout from './nav/NavigationLayout';
import RateLimitBanner from './components/RateLimitBanner';
import { useDataDragonStore } from './store/dataDragonStore';

import AuthModal from './components/AuthModal';

/**
 * The root component of the application.
 * It sets up the main layout, routing, and global components like RateLimitBanner.
 * Bootstraps static game data by first fetching the latest DDragon version,
 * then loading items, spells, and runes.
 */
function App() {
  const { fetchVersion, fetchItemData, fetchSummonerSpellData, fetchRuneData, fetchChampionData, versionReady } = useDataDragonStore();

  // Step 1: Resolve the current patch version as soon as the app loads.
  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  // Step 2: Pre-fetch static game data (including champion tags) only after the CDN URL has been set.
  useEffect(() => {
    if (!versionReady) return;
    fetchItemData();
    fetchSummonerSpellData();
    fetchRuneData();
    fetchChampionData();
  }, [versionReady, fetchItemData, fetchSummonerSpellData, fetchRuneData, fetchChampionData]);

  return (
    <div className="bg-slate-100 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 h-screen flex flex-col overflow-y-auto antialiased selection:bg-sky-500/20 selection:text-sky-600 dark:selection:bg-cyan-400/20 dark:selection:text-cyan-300">
        <RateLimitBanner />
        <NavigationLayout />
        <AuthModal />
    </div>
  );
}

export default App;
