import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Globe, Compass, Activity, MessageSquare, Clock, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { fetchAutocompleteSuggestions, type AutocompletePlayerDto } from '../../api/search';
import { toUrlRegion } from '../../utils/regionUtils';

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SHARDS = [
  { id: 'EUW1', label: 'EUW', name: 'Europe West' },
  { id: 'NA1', label: 'NA', name: 'North America' },
  { id: 'KR', label: 'KR', name: 'Korea' },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open: controlledOpen, onOpenChange }) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompletePlayerDto[]>([]);
  const [searching, setSearching] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (val: boolean) => {
    setInternalOpen(val);
    onOpenChange?.(val);
  };

  const navigate = useNavigate();
  const region = useAuthStore((state) => state.region);
  const setRegion = useAuthStore((state) => state.setRegion);
  const recentSearches = useAuthStore((state) => state.recentSearches);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(!isOpen);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    const openListener = () => setIsOpen(true);
    window.addEventListener('open-command-palette', openListener);
    return () => window.removeEventListener('open-command-palette', openListener);
  });

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetchAutocompleteSuggestions(query.trim());
        setSuggestions(Array.isArray(res) ? res : []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const handleDirectSearch = (riotIdText: string, targetRegion = region) => {
    const parts = riotIdText.split('#');
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      const name = parts[0].trim();
      const tag = parts[1].trim();
      setRegion(targetRegion);
      setIsOpen(false);
      setQuery('');
      navigate(`/profile/${toUrlRegion(targetRegion)}/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div className="w-full max-w-xl rounded-xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-fade-in-down">
        <Command label="Summoner Command Palette" shouldFilter={false} className="w-full">
          {/* Input Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <Search className="w-4 h-4 text-sky-600 dark:text-cyan-400 shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Type a Riot ID (Name#TAG) or select a command..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.includes('#')) {
                  e.preventDefault();
                  handleDirectSearch(query);
                }
              }}
              className="w-full bg-transparent text-sm font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 dark:text-slate-400 telemetry-nums"
            >
              ESC
            </button>
          </div>

          {/* Active Shard Switcher Bar */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-[#090d16] border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-cyan-400" />
              Active Shard
            </span>
            <div className="flex items-center gap-1.5 telemetry-nums">
              {SHARDS.map((s) => {
                const active = region.toUpperCase() === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setRegion(s.id)}
                    className={`px-2 py-0.5 rounded text-xs font-extrabold transition-colors border ${
                      active
                        ? 'bg-sky-500/15 dark:bg-cyan-500/20 text-sky-700 dark:text-cyan-300 border-sky-500/30 dark:border-cyan-500/40'
                        : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-2">
            {query.includes('#') && (
              <Command.Group heading="Direct Riot ID Lookup" className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                <Command.Item
                  onSelect={() => handleDirectSearch(query)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer bg-sky-500/10 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 border border-sky-500/25 dark:border-cyan-500/25 mt-1"
                >
                  <div className="flex items-center gap-2.5 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Search &ldquo;{query}&rdquo; on {region.replace(/[0-9]/g, '')}</span>
                  </div>
                  <span className="text-[11px] telemetry-nums font-bold">↵ Enter</span>
                </Command.Item>
              </Command.Group>
            )}

            {suggestions.length > 0 && (
              <Command.Group heading="Matched Summoners" className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                {suggestions.map((player) => (
                  <Command.Item
                    key={player.puuid}
                    onSelect={() => handleDirectSearch(`${player.gameName}#${player.tagLine}`, player.region)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 transition-colors mt-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <img
                        src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${player.profileIconId}.jpg`}
                        alt={player.gameName}
                        className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-700 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/29.jpg';
                        }}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{player.gameName}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 telemetry-nums ml-1">#{player.tagLine}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase telemetry-nums">
                      {player.region.replace(/[0-9]/g, '')} • Lvl {player.summonerLevel}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {recentSearches.length > 0 && (
              <Command.Group heading="Recent Searches" className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                {recentSearches.slice(0, 5).map((item, idx) => (
                  <Command.Item
                    key={`${item.query}-${idx}`}
                    onSelect={() => handleDirectSearch(item.query, item.server)}
                    className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200 transition-colors mt-1"
                  >
                    <div className="flex items-center gap-2.5 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.query}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase telemetry-nums text-slate-500 dark:text-slate-400">
                      {item.server.replace(/[0-9]/g, '')}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Quick Navigation" className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
              <Command.Item
                onSelect={() => { setIsOpen(false); navigate('/search'); }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1"
              >
                <span className="flex items-center gap-2.5"><Search className="w-3.5 h-3.5 text-sky-500 dark:text-cyan-400" /> Summoner Search</span>
                <span className="text-[11px] text-slate-400 telemetry-nums">/search</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { setIsOpen(false); navigate('/dashboard'); }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1"
              >
                <span className="flex items-center gap-2.5"><Compass className="w-3.5 h-3.5 text-sky-500 dark:text-cyan-400" /> Leaderboards & Dashboard</span>
                <span className="text-[11px] text-slate-400 telemetry-nums">/dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { setIsOpen(false); navigate('/status'); }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1"
              >
                <span className="flex items-center gap-2.5"><Activity className="w-3.5 h-3.5 text-emerald-400" /> Riot API Shard Status</span>
                <span className="text-[11px] text-slate-400 telemetry-nums">/status</span>
              </Command.Item>
              <Command.Item
                onSelect={() => { setIsOpen(false); navigate('/feedback'); }}
                className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/70 text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1"
              >
                <span className="flex items-center gap-2.5"><MessageSquare className="w-3.5 h-3.5 text-amber-400" /> Send Feedback</span>
                <span className="text-[11px] text-slate-400 telemetry-nums">/feedback</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 telemetry-nums">
            <span>{searching ? 'Searching Riot directory...' : 'Format: SummonerName#TAG'}</span>
            <span>⌘K to toggle • ↵ to select</span>
          </div>
        </Command>
      </div>
    </div>
  );
};

export default CommandPalette;
