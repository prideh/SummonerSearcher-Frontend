import { create } from 'zustand'; 
import axios from 'axios';

/** The current version of Riot's Data Dragon, used for fetching static game data. */
const ddragonVersion = import.meta.env.VITE_DDRAGON_VERSION || '15.23.1';

/** The base URL for Data Dragon's data and image assets for a specific version. */
const CDN_URL = `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}`;
/** The base URL for Data Dragon's general image assets (not version-specific). */
const DDRAGON_IMG_URL = 'https://ddragon.leagueoflegends.com/cdn/img';
/** The base URL for Community Dragon, used for assets not available in the official Data Dragon (e.g., rank emblems). */
const COMMUNITY_DRAGON_URL = 'https://raw.communitydragon.org/latest/plugins';

/** Defines the structure of the data for a single item from Data Dragon. */
export interface ItemData {
  name: string;
  description: string;
  plaintext: string;
  gold: {
    base: number;
    total: number;
    sell: number;
    purchasable: boolean;
  };
}

/** A map of item IDs to their corresponding ItemData. */
export interface ItemMap {
  [key: string]: ItemData;
}

/** Defines the structure of the data for a single summoner spell from Data Dragon. */
export interface SummonerSpellData {
  id: string;
  name: string;
  description: string;
  key: string; // This is the numeric ID as a string
  image: {
    full: string;
  };
}

/** A map of summoner spell numeric keys to their corresponding SummonerSpellData. */
export interface SummonerSpellMap {
  [key: string]: SummonerSpellData;
}

/** Defines the structure of the data for a single rune from Data Dragon. */
export interface RuneData {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
}

/** Defines the structure for a rune path (e.g., Precision, Domination). */
export interface RunePathData {
  id: number;
  key: string;
  icon: string;
  name: string;
}

/** A map of rune or rune path IDs to their corresponding RuneData. */
export interface RuneMap {
  [key: string]: RuneData;
}

/** Defines the structure of the data for a single champion from Data Dragon. */
export interface ChampionData {
  id: string;
  key: string;
  name: string;
  tags: string[];
}

/** A map of champion numeric keys to their corresponding ChampionData. */
export interface ChampionMap {
  [key: string]: ChampionData;
}

// --- Internal types for parsing DDragon response ---
interface DDragonRune extends RuneData {
  longDesc: string;
  shortDesc: string;
}

interface DDragonRuneSlot {
  runes: DDragonRune[];
}

interface DDragonRunePath {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: DDragonRuneSlot[];
}
// ----------------------------------------------------

/**
 * Defines the state and actions for the Data Dragon Zustand store.
 */
interface DataDragonState {
  cdnUrl: string;
  cdnImgUrl: string;
  communityDragonUrl: string;
  itemMap: ItemMap | null;
  summonerSpellMap: SummonerSpellMap | null;
  runeMap: RuneMap | null;
  championMap: ChampionMap | null;
  loading: {
    items: boolean;
    spells: boolean;
    runes: boolean;
    champions: boolean;
  };
  fetchItemData: () => Promise<void>;
  fetchSummonerSpellData: () => Promise<void>;
  fetchRuneData: () => Promise<void>;
  fetchChampionData: () => Promise<void>;
}

/**
 * Creates a Zustand store to manage and cache static game data from Riot's Data Dragon.
 * This prevents redundant API calls for data like items, spells, and runes, which rarely change.
 * The data is fetched on-demand and stored in the state.
 */
export const useDataDragonStore = create<DataDragonState>((set, get) => ({
  cdnUrl: CDN_URL,
  cdnImgUrl: DDRAGON_IMG_URL,
  communityDragonUrl: COMMUNITY_DRAGON_URL,
  itemMap: null,
  summonerSpellMap: null,
  runeMap: null,
  championMap: null,
  loading: {
    items: false,
    spells: false,
    runes: false,
    champions: false,
  },
  /**
   * Fetches item data from Data Dragon and stores it in the `itemMap`.
   */
  fetchItemData: async () => {
    if (get().itemMap || get().loading.items) return;
    set(state => ({ loading: { ...state.loading, items: true } }));
    try {
      const response = await axios.get(`${get().cdnUrl}/data/en_US/item.json`);
      set({ itemMap: response.data.data });
    } finally {
      set(state => ({ loading: { ...state.loading, items: false } }));
    }
  },
  /**
   * Fetches summoner spell data from Data Dragon and stores it in the `summonerSpellMap`, keyed by spell ID.
   */
  fetchSummonerSpellData: async () => {
    if (get().summonerSpellMap || get().loading.spells) return;
    set(state => ({ loading: { ...state.loading, spells: true } }));
    try {
      const response = await axios.get(`${get().cdnUrl}/data/en_US/summoner.json`);
      const spellData = response.data.data;
      const spellMap: SummonerSpellMap = {};
      for (const spellName in spellData) {
        spellMap[spellData[spellName].key] = spellData[spellName];
      }
      set({ summonerSpellMap: spellMap });
    } finally {
      set(state => ({ loading: { ...state.loading, spells: false } }));
    }
  },
  /**
   * Fetches rune and rune path data from Data Dragon and stores it in a unified `runeMap`.
   */
  fetchRuneData: async () => {
    if (get().runeMap || get().loading.runes) return;
    set(state => ({ loading: { ...state.loading, runes: true } }));
    try {
      const response = await axios.get<DDragonRunePath[]>(`${get().cdnUrl}/data/en_US/runesReforged.json`);
      const runeData = response.data;
     
      const runeMap: RuneMap = {};

      // First, add all individual runes to the map
      runeData.forEach(path => {
        path.slots.forEach((slot) => {
          slot.runes.forEach((rune) => {
            runeMap[rune.id] = rune;
          });
        });
      });

      // Second, add the main paths to the map. This prevents them from being overwritten.
      runeData.forEach(path => {
        if (!runeMap[path.id]) {
          runeMap[path.id] = { ...path, shortDesc: `${path.name} Path`, longDesc: '' };
        }
      });

      set({ runeMap });
    } finally {
      set(state => ({ loading: { ...state.loading, runes: false } }));
    }
  },
  /**
   * Fetches champion data from Data Dragon and stores it in the `championMap`, keyed by champion ID.
   */
  fetchChampionData: async () => {
    if (get().championMap || get().loading.champions) return;
    set(state => ({ loading: { ...state.loading, champions: true } }));
    try {
      const response = await axios.get(`${get().cdnUrl}/data/en_US/champion.json`);
      const championData = response.data.data;
      const championMap: ChampionMap = {};
      for (const championName in championData) {
        championMap[championData[championName].key] = championData[championName];
      }
      set({ championMap });
    } finally {
      set(state => ({ loading: { ...state.loading, champions: false } }));
    }
  },
}));
