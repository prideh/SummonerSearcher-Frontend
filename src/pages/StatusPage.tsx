import { useState, type ReactNode } from 'react';
import { getRiotServerStatus } from '../api/riot';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

interface StatusUpdate {
  id: number;
  maintenance_status: 'scheduled' | 'in_progress' | 'complete';
  incident_severity: 'info' | 'warning' | 'critical';
  titles: { locale: string; content: string }[];
  updates: {
    author: string;
    content: string;
    created_at: string;
    translations: { locale: string; content: string }[];
  }[];
}

interface RiotStatus {
  name: string;
  maintenances: StatusUpdate[];
  incidents: StatusUpdate[];
}

const StatusPage = () => {
  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const [status, setStatus] = useState<RiotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchStatus = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data: RiotStatus = await getRiotServerStatus(region);
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

  const renderUpdates = (updates: StatusUpdate[], type: 'Maintenance' | 'Incident'): ReactNode => {
    if (updates.length === 0) {
      return null;
    }

    return (
      <div className="mt-6">
        <h3 className={`text-2xl font-bold mb-4 ${type === 'Incident' ? 'text-red-400' : 'text-yellow-400'}`}>
          {type === 'Incident' ? 'Active Incidents' : 'Maintenances'}
        </h3>
        {updates.map((update) => (
          <div key={update.id} className="bg-gray-800 p-4 rounded-lg mb-4 shadow">
            <h4 className="text-xl font-semibold text-white">{update.titles[0]?.content || 'No Title'}</h4>
            <p className="text-sm text-gray-400 capitalize">
              Severity: {update.incident_severity} | Status: {update.maintenance_status.replace('_', ' ')}
            </p>
            {update.updates.map((u, index) => (
              <div key={index} className="mt-3 border-t border-gray-700 pt-3">
                <p className="text-gray-300">{u.translations[0]?.content || u.content}</p>
                <p className="text-xs text-gray-500 mt-1">
                  by {u.author} at {new Date(u.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const hasContent = status && (status.incidents.length > 0 || status.maintenances.length > 0);
  const noIssues = status && !hasContent;

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center">Riot Games Server Status</h2>
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="p-2 border border-gray-700 rounded-md bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="EUW1">EUW</option>
        <option value="NA1">NA</option>
        <option value="KR">KR</option>
      </select>
        <button onClick={handleFetchStatus} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed">
        {loading ? 'Loading...' : 'Get Status'}
      </button>
      </div>

      {error && <p className="text-red-500 text-center mb-4">{error}</p>}

      <div className="max-w-4xl mx-auto">
        {noIssues && (
          <div className="bg-green-800 bg-opacity-50 border border-green-600 text-green-300 px-4 py-3 rounded-lg relative text-center" role="alert">
            <strong className="font-bold">All good!</strong>
            <span className="block sm:inline"> No active incidents or maintenances reported for {status.name}.</span>
          </div>
        )}

        {status && (
          renderUpdates(status.incidents, 'Incident')
        )}
        {status && (
          renderUpdates(status.maintenances, 'Maintenance')
        )}
      </div>
    </div>
  );
};

export default StatusPage;