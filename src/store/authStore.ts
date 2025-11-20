import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SummonerData } from '../types/summoner';

interface AuthState {
  token: string | null;
  isLoggedIn: boolean;
  is2faEnabled: boolean;
  darkMode: boolean;
  username: string | null;
  lastSearchedSummoner: SummonerData | 'NOT_FOUND' | null;
  searchInput: string;
  region: string;
  login: (token: string, email: string, is2faEnabled: boolean, darkMode: boolean) => void;
  logout: () => void;
  update2FAStatus: (isEnabled: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  setRegion: (region: string) => void;
  setSearchInput: (input: string) => void;
  setLastSearchedSummoner: (summoner: SummonerData | 'NOT_FOUND' | null) => void;
}

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
      login: (token, email, is2faEnabled, darkMode) =>
        set({
          token,
          isLoggedIn: true,
          username: email,
          is2faEnabled,
          darkMode,
        }),
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
      update2FAStatus: (isEnabled: boolean) => set({ is2faEnabled: isEnabled }),
      setDarkMode: (enabled: boolean) => set({ darkMode: enabled }),
      setRegion: (newRegion: string) => set({ region: newRegion }),
      setSearchInput: (input: string) => set({ searchInput: input }),
      setLastSearchedSummoner: (summoner) => set({ lastSearchedSummoner: summoner }),
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ token: state.token, username: state.username, is2faEnabled: state.is2faEnabled, darkMode: state.darkMode, region: state.region, isLoggedIn: !!state.token, lastSearchedSummoner: state.lastSearchedSummoner, searchInput: state.searchInput }),
    }
  )
);