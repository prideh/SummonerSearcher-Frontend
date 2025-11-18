import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SummonerData } from '../types/summoner';

interface AuthState {
  token: string | null;
  isLoggedIn: boolean;
  is2faEnabled: boolean;
  username: string | null;
  lastSearchedSummoner: SummonerData | null;
  region: string;
  login: (token: string, email: string, is2faEnabled: boolean) => void;
  logout: () => void;
  update2FAStatus: (isEnabled: boolean) => void;
  setRegion: (region: string) => void;
  setLastSearchedSummoner: (summoner: SummonerData | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isLoggedIn: false,
      is2faEnabled: false,
      username: null,
      lastSearchedSummoner: null,
      region: 'EUW1', // Default region
      login: (token, email, is2faEnabled) =>
        set({
          token,
          isLoggedIn: true,
          username: email,
          is2faEnabled,
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
        });
      },
      update2FAStatus: (isEnabled: boolean) => set({ is2faEnabled: isEnabled }),
      setRegion: (newRegion: string) => set({ region: newRegion }),
      setLastSearchedSummoner: (summoner) => set({ lastSearchedSummoner: summoner }),
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ token: state.token, username: state.username, is2faEnabled: state.is2faEnabled, region: state.region, isLoggedIn: !!state.token, lastSearchedSummoner: state.lastSearchedSummoner }),
    }
  )
);