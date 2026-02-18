import { useEffect } from 'react';
import NavigationLayout from './nav/NavigationLayout';
import RateLimitBanner from './components/RateLimitBanner';
import { useDataDragonStore } from './store/dataDragonStore';

import AuthModal from './components/AuthModal';

/**
 * The root component of the application.
 * It sets up the main layout, routing, and global components like RateLimitBanner.
 * It also triggers the pre-fetching of static game data.
 */
function App() {
  // Pre-fetch critical static game data (items, spells, runes) as soon as the app loads
  // to ensure it's available when components that need it are rendered.
  const { fetchItemData, fetchSummonerSpellData, fetchRuneData } = useDataDragonStore();
  useEffect(() => {
    fetchItemData();
    fetchSummonerSpellData();
    fetchRuneData();
  }, [fetchItemData, fetchSummonerSpellData, fetchRuneData]);

  return (
    <div className="bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200 h-screen flex flex-col overflow-y-auto">
        <RateLimitBanner />
        <NavigationLayout />
        <AuthModal />
    </div>
  );
}

export default App;
