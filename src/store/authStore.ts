import { create } from 'zustand';
import axios from 'axios';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SummonerData } from '../types/summoner';
import type { RecentSearch } from '../api/user';

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
  recentSearches: RecentSearch[];
  
  // Modal State
  authModalOpen: boolean;
  authView: 'login' | 'register' | 'forgot-password';

  // Actions to update the state
  login: (token: string, email: string, is2faEnabled: boolean, darkMode: boolean) => void;
  logout: () => Promise<void>;
  update2FAStatus: (isEnabled: boolean) => void;
  setDarkMode: (enabled: boolean) => void;
  setRegion: (region: string) => void;
  setSearchInput: (input: string) => void;
  setLastSearchedSummoner: (summoner: SummonerData | 'NOT_FOUND' | null) => void;
  addRecentSearch: (search: RecentSearch) => void;
  clearRecentSearches: () => void;
  
  // Modal Actions
  openAuthModal: (view: 'login' | 'register' | 'forgot-password') => void;
  closeAuthModal: () => void;
}

/**
 * Creates a persistent Zustand store for managing authentication and user-related state.
 * `persist` middleware saves the specified parts of the state to localStorage,
 * so it remains available across browser sessions.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isLoggedIn: false,
      is2faEnabled: false,
      darkMode: true, // Default to dark mode
      username: null,
      lastSearchedSummoner: null,
      searchInput: '',
      region: 'EUW1', // Default region
      recentSearches: [],
      
      authModalOpen: false,
      authView: 'login',

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
       * Also calls the backend to clear the refresh token cookie.
       */
      logout: async () => {
        try {
          await axios.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/logout`, {}, { withCredentials: true });
        } catch (error) {
          console.error('Logout failed:', error);
        }

        // Also clear other user-specific data from localStorage if needed
        // Zustand persist middleware will handle clearing the state from storage when we set it to empty
        
        set({
          token: null,
          isLoggedIn: false,
          username: null,
          is2faEnabled: false,
          lastSearchedSummoner: null,
          searchInput: '',
          recentSearches: [],
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
      // Action to add a recent search locally (for guest users)
      addRecentSearch: (search) => {
          const currentSearches = get().recentSearches;
          // Filter out duplicates (same query and server)
          const filtered = currentSearches.filter(
              s => !(s.query.toLowerCase() === search.query.toLowerCase() && s.server === search.server)
          );
          // Add new search to the front and limit to 5
          const updated = [search, ...filtered].slice(0, 5);
          set({ recentSearches: updated });
      },
      // Action to clear local recent searches
      clearRecentSearches: () => set({ recentSearches: [] }),
      
      openAuthModal: (view) => set({ authModalOpen: true, authView: view }),
      closeAuthModal: () => set({ authModalOpen: false }),
    }),
    {
      name: 'auth-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      // `partialize` ensures only the specified fields are persisted to localStorage.
      partialize: (state) => ({ 
          token: state.token, 
          username: state.username, 
          is2faEnabled: state.is2faEnabled, 
          darkMode: state.darkMode, 
          region: state.region, 
          isLoggedIn: !!state.token, 
          searchInput: state.searchInput,
          recentSearches: state.recentSearches 
      }),
    }
  )
);