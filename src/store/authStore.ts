import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SummonerData } from '../types/summoner';

/**
 * Defines the structure of the authentication and user state managed by Zustand.
 */
interface AuthState {
  token: string | null;
  isLoggedIn: boolean;
  is2faEnabled: boolean;
  darkMode: boolean;
  username: string | null;
  lastSearchedSummoner: SummonerData | 'NOT_FOUND' | null;
  searchInput: string;
  region: string;
  // Actions to update the state
  login: (token: string, email: string, is2faEnabled: boolean, darkMode: boolean) => void;
  logout: () => void;
  update2FAStatus: (isEnabled: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  setRegion: (region: string) => void;
  setSearchInput: (input: string) => void;
  setLastSearchedSummoner: (summoner: SummonerData | 'NOT_FOUND' | null) => void;
}

/**
 * Creates a persistent Zustand store for managing authentication and user-related state.
 * `persist` middleware saves the specified parts of the state to localStorage,
 * so it remains available across browser sessions.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isLoggedIn: false,
      is2faEnabled: false,
      darkMode: true, // Default to dark mode
      username: null,
      lastSearchedSummoner: null,
      searchInput: '',
      region: 'EUW1', // Default region
      /**
       * Sets the user's state to logged-in upon successful authentication.
       */
      login: (token, email, is2faEnabled, darkMode) =>
        set({
          token,
          isLoggedIn: true,
          username: email,
          is2faEnabled,
          darkMode,
        }),
      /**
       * Clears all authentication and user-specific data from the state and localStorage.
       */
      logout: () => {
        // Also clear other user-specific data from localStorage if needed
        localStorage.removeItem('darkmodePreference');
        localStorage.removeItem('recentSearches');
        set({
          token: null,
          isLoggedIn: false,
          username: null,
          is2faEnabled: false,
          lastSearchedSummoner: null,
          darkMode: true,
          searchInput: '',
        });
      },
      // Action to update only the 2FA status.
      update2FAStatus: (isEnabled: boolean) => set({ is2faEnabled: isEnabled }),
      // Action to update the dark mode preference.
      setDarkMode: (enabled: boolean) => set({ darkMode: enabled }),
      // Action to update the selected search region.
      setRegion: (newRegion: string) => set({ region: newRegion }),
      // Action to update the content of the search bar.
      setSearchInput: (input: string) => set({ searchInput: input }),
      // Action to cache the last successfully searched summoner data or a 'NOT_FOUND' status.
      setLastSearchedSummoner: (summoner) => set({ lastSearchedSummoner: summoner }),
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      // `partialize` ensures only the specified fields are persisted to localStorage.
      partialize: (state) => ({ token: state.token, username: state.username, is2faEnabled: state.is2faEnabled, darkMode: state.darkMode, region: state.region, isLoggedIn: !!state.token, lastSearchedSummoner: state.lastSearchedSummoner, searchInput: state.searchInput }),
    }
  )
);