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
  const { fetchVersion, fetchItemData, fetchSummonerSpellData, fetchRuneData, versionReady } = useDataDragonStore();

  // Step 1: Resolve the current patch version as soon as the app loads.
  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  // Step 2: Pre-fetch static game data only after the CDN URL has been set.
  useEffect(() => {
    if (!versionReady) return;
    fetchItemData();
    fetchSummonerSpellData();
    fetchRuneData();
  }, [versionReady, fetchItemData, fetchSummonerSpellData, fetchRuneData]);

  return (
    <div className="bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200 h-screen flex flex-col overflow-y-auto">
        <RateLimitBanner />
        <NavigationLayout />
        <AuthModal />
    </div>
  );
}

export default App;
