import { create } from 'zustand'; 
import axios from 'axios';

const CDN_URL = 'https://ddragon.leagueoflegends.com/cdn/15.23.1';
const DDRAGON_IMG_URL = 'https://ddragon.leagueoflegends.com/cdn/img/';

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

export interface ItemMap {
  [key: string]: ItemData;
}

export interface SummonerSpellData {
  id: string;
  name: string;
  description: string;
  key: string; // This is the numeric ID as a string
  image: {
    full: string;
  };
}

export interface SummonerSpellMap {
  [key: string]: SummonerSpellData;
}

export interface RuneData {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
}

export interface RunePathData {
  id: number;
  key: string;
  icon: string;
  name: string;
}

export interface RuneMap {
  [key: string]: RuneData;
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

interface DataDragonState {
  cdnUrl: string;
  cdnImgUrl: string;
  itemMap: ItemMap | null;
  summonerSpellMap: SummonerSpellMap | null;
  runeMap: RuneMap | null;
  loading: {
    items: boolean;
    spells: boolean;
    runes: boolean;
  };
  fetchItemData: () => Promise<void>;
  fetchSummonerSpellData: () => Promise<void>;
  fetchRuneData: () => Promise<void>;
}

export const useDataDragonStore = create<DataDragonState>((set, get) => ({
  cdnUrl: CDN_URL,
  cdnImgUrl: DDRAGON_IMG_URL,
  itemMap: null,
  summonerSpellMap: null,
  runeMap: null,
  loading: {
    items: false,
    spells: false,
    runes: false,
  },
  fetchItemData: async () => {
    if (get().itemMap || get().loading.items) return;
    set(state => ({ loading: { ...state.loading, items: true } }));
    try {
      const response = await axios.get(`${CDN_URL}/data/en_US/item.json`);
      set({ itemMap: response.data.data });
    } finally {
      set(state => ({ loading: { ...state.loading, items: false } }));
    }
  },
  fetchSummonerSpellData: async () => {
    if (get().summonerSpellMap || get().loading.spells) return;
    set(state => ({ loading: { ...state.loading, spells: true } }));
    try {
      const response = await axios.get(`${CDN_URL}/data/en_US/summoner.json`);
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
  fetchRuneData: async () => {
    if (get().runeMap || get().loading.runes) return;
    set(state => ({ loading: { ...state.loading, runes: true } }));
    try {
      const response = await axios.get<DDragonRunePath[]>(`${CDN_URL}/data/en_US/runesReforged.json`);
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
}));
