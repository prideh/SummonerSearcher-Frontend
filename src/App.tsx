import { useEffect } from 'react';
import NavigationLayout from './nav/NavigationLayout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDataDragonStore } from './store/dataDragonStore';

function App() {
  // Pre-fetch critical game data as soon as the app loads
  const { fetchItemData, fetchSummonerSpellData, fetchRuneData } = useDataDragonStore();
  useEffect(() => {
    fetchItemData();
    fetchSummonerSpellData();
    fetchRuneData();
  }, [fetchItemData, fetchSummonerSpellData, fetchRuneData]);

  return (
    <div className="bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200 min-h-screen">
        <NavigationLayout />
        <ToastContainer />
    </div>
  );
}

export default App;
