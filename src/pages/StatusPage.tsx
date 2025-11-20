import React, { useState, type ReactNode } from 'react';
import { getRiotServerStatus } from '../api/riot';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

/** Defines the structure for a single status update (maintenance or incident). */
interface StatusItemDto {
  status: string | null;
  severity: string | null;
  title: string;
  description: string;
  platforms: string[];
}

/** Defines the structure for the overall platform status response. */
interface PlatformStatusDto {
  name: string;
  maintenances: StatusItemDto[];
  incidents: StatusItemDto[];
}

/**
 * The StatusPage allows users to check the live server status for various Riot Games regions.
 * It fetches and displays any ongoing maintenances or incidents for the selected region.
 */
const StatusPage = () => {
  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const [status, setStatus] = useState<PlatformStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches the server status for the currently selected region from the backend API.
   */
  const handleFetchStatus = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data: PlatformStatusDto = await getRiotServerStatus(region);
      setStatus(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(error.response?.data.message || error.message);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred.');
      }
    }
    setLoading(false);
  };

  /**
   * Renders a list of status updates (either maintenances or incidents).
   * @param updates - An array of status items to render.
   * @param type - The type of update, used for titling and styling.
   */
  const renderUpdates = (updates: StatusItemDto[], type: 'Maintenance' | 'Incident'): ReactNode => {
    if (!updates || updates.length === 0) {
      return null;
    }

    return (
      <div className="mt-6">
        <h3 className={`text-2xl font-bold mb-4 ${type === 'Incident' ? 'text-red-400' : 'text-yellow-400'}`}>
          {type === 'Incident' ? 'Active Incidents' : 'Maintenances'}
        </h3>
        {updates.map((item, index) => (
          <div key={`${type}-${index}`} className="bg-gray-900 p-4 rounded-lg mb-4 shadow">
            <h4 className="text-xl font-semibold text-gray-800 dark:text-white">{item.title}</h4>
            <div className="text-sm text-gray-500 dark:text-gray-400 capitalize flex items-center space-x-2">
              {item.severity && <span key="severity">Severity: {item.severity}</span>}
            </div>
            <p className="text-gray-700 dark:text-gray-300 mt-3">{item.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Platforms: {item.platforms.join(', ')}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center">Riot Games Server Status</h2>
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
        <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Select Region" className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-cyan-500">
        <option value="EUW1">EUW</option>
        <option value="NA1">NA</option>
        <option value="KR">KR</option>
      </select>
        <button onClick={handleFetchStatus} disabled={loading} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:bg-cyan-400 disabled:cursor-not-allowed">
        {loading ? 'Loading...' : 'Get Status'}
      </button>
      </div>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <div className="max-w-4xl mx-auto">
        {status && status.incidents.length === 0 && status.maintenances.length === 0 && (
          <div className="bg-green-800 bg-opacity-50 border border-green-600 text-green-300 px-4 py-3 rounded-lg relative text-center" role="alert">
            <strong className="font-bold">All good!</strong>
            <span className="block sm:inline"> No active incidents or maintenances reported for {status.name}.</span>
          </div>
        )}

        {status && (
          <React.Fragment key="incidents">{renderUpdates(status.incidents, 'Incident')}</React.Fragment>
        )}
        {status && (
          <React.Fragment key="maintenances">{renderUpdates(status.maintenances, 'Maintenance')}</React.Fragment>
        )}
      </div>
    </div>
  );
};

export default StatusPage;