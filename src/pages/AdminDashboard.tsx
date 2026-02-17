import React, { useEffect, useState } from 'react';
import { getAiMetrics, getCurationHistory, type AiMetricsResponse, type CurationRunResponse } from '../api/aiMetrics';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<AiMetricsResponse | null>(null);
  const [history, setHistory] = useState<CurationRunResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect if not logged in
    if (!isLoggedIn) {
      navigate('/');
      return;
    }

    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const metricsData = await getAiMetrics();
        setMetrics(metricsData);
        
        // Try to fetch history, but don't fail if it's unavailable
        try {
          const historyData = await getCurationHistory();
          setHistory(historyData);
        } catch (historyErr) {
          console.warn('Could not load curation history:', historyErr);
          setHistory([]);
        }
        
        setError(null);
      } catch (err: unknown) {
        const error = err as { response?: { status?: number } };
        if (error.response?.status === 403) {
          setError('Access Denied: Admin privileges required');
        } else if (error.response?.status === 401) {
          setError('Authentication required');
          navigate('/');
        } else {
          setError('Failed to load metrics');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [isLoggedIn, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-600 dark:text-red-400 text-center">
            <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const weeklyChange = metrics.thisWeekInteractions - metrics.lastWeekInteractions;
  const weeklyChangePercent = metrics.lastWeekInteractions > 0 
    ? ((weeklyChange / metrics.lastWeekInteractions) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🤖 AI Metrics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor your self-learning AI coach performance
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Interactions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Interactions</h3>
              <svg className="w-8 h-8 text-cyan-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.totalInteractions.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              AI chat sessions recorded
            </p>
          </div>

          {/* Satisfaction Rate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Satisfaction Rate</h3>
              <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.satisfactionRate}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Positive feedback ratio
            </p>
          </div>

          {/* Learned Examples */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Learned Examples</h3>
              <svg className="w-8 h-8 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.learnedExamplesCount}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              High-quality training examples
            </p>
          </div>

          {/* Validated Feedback */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Validated Feedback</h3>
              <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.validatedFeedbackCount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Abuse-protected ratings
            </p>
          </div>

          {/* This Week */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</h3>
              <svg className="w-8 h-8 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics.thisWeekInteractions}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Positive interactions (last 7 days)
            </p>
          </div>

          {/* Weekly Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Weekly Trend</h3>
              {weeklyChange >= 0 ? (
                <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 14.586 13H12z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <p className={`text-3xl font-bold ${weeklyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {weeklyChange >= 0 ? '+' : ''}{weeklyChange}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {weeklyChangePercent}% vs last week
            </p>
          </div>
        </div>

        {/* Curation History Table */}
        {history.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              🗓️ Curation Run History (Last 30 Days)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Candidates</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3">Replaced</th>
                    <th className="px-4 py-3">Avg Quality</th>
                    <th className="px-4 py-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((run, index) => {
                    const date = new Date(run.runDate);
                    
                    return (
                      <tr key={index} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {run.candidatesFound}
                        </td>
                        <td className="px-4 py-3">
                          {run.examplesAdded > 0 ? (
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              +{run.examplesAdded}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {run.examplesReplaced > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              ↻{run.examplesReplaced}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {run.avgQualityScore ? (
                            <span className={`font-semibold ${
                              run.avgQualityScore >= 90 ? 'text-green-600 dark:text-green-400' :
                              run.avgQualityScore >= 85 ? 'text-cyan-600 dark:text-cyan-400' :
                              'text-gray-600 dark:text-gray-400'
                            }`}>
                              {run.avgQualityScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {history.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                No curation runs yet. The first run will happen at 2:00 AM.
              </p>
            )}
          </div>
        )}

        {/* Info Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            📊 About These Metrics
          </h2>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <strong className="text-gray-900 dark:text-white">Total Interactions:</strong> Every AI chat session is saved for learning, even before feedback is given.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Satisfaction Rate:</strong> Percentage of positive thumbs-up ratings from validated (non-abusive) feedback.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Learned Examples:</strong> High-quality (score &gt;80) responses used for few-shot learning. Maximum 10 per category.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Curation Schedule:</strong> New examples are automatically curated daily at 2:00 AM. Check logs for details.
            </p>
            <p className="bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500 p-3 rounded">
              <strong className="text-cyan-900 dark:text-cyan-300">💡 Tip:</strong> As learned examples grow, AI responses improve automatically. Expect 60-70% satisfaction improvement over 6 months.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
