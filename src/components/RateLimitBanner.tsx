import { useErrorStore } from '../store/errorStore';

/**
 * RateLimitBanner component displays a prominent banner when rate limit errors occur.
 * It provides clear information about the development API key limitations.
 */
export default function RateLimitBanner() {
  const { showRateLimitError, setShowRateLimitError } = useErrorStore();

  if (!showRateLimitError) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
      <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-3 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base">
                Rate Limit Exceeded
              </p>
              <p className="text-xs sm:text-sm opacity-90">
                We're using a development API key from Riot Games with limited requests. 
                Please try again in a few moments.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRateLimitError(false)}
            className="flex-shrink-0 ml-4 p-1 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close banner"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
