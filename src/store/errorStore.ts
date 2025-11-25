import { create } from 'zustand';

interface ErrorState {
  showRateLimitError: boolean;
  setShowRateLimitError: (show: boolean) => void;
}

/**
 * Global error state store using Zustand.
 * Manages the display state of error banners/modals across the application.
 */
export const useErrorStore = create<ErrorState>((set) => ({
  showRateLimitError: false,
  setShowRateLimitError: (show: boolean) => set({ showRateLimitError: show }),
}));
