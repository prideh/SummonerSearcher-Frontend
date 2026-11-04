import React, { useState, useEffect } from 'react';
import { useDataDragonStore } from '../store/dataDragonStore';
import SummonerSpellIcon from './SummonerSpellIcon';
import RuneIcon from './RuneIcon';
import { getWinRateColorClass } from '../utils/colorUtils';

interface BannedChampion {
  pickTurn: number;
  championId: number;
  teamId: number;
}

interface CurrentGameParticipant {
  championId: number;
  perks: {
    perkIds: number[];
    perkStyle: number;
    perkSubStyle: number;
  };
  profileIconId: number;
  bot: boolean;
  teamId: number;
  summonerName: string;
  summonerId: string;
  riotId?: string;
  puuid?: string;
  spell1Id: number;
  spell2Id: number;
  tier?: string;
  rank?: string;
  leaguePoints?: number;
  wins?: number;
  losses?: number;
}

export interface CurrentGameInfo {
  gameId: number;
  gameType: string;
  gameStartTime: number;
  mapId: number;
  gameLength: number;
  platformId: string;
  gameMode: string;
  bannedChampions: BannedChampion[];
  participants: CurrentGameParticipant[];
}


interface LiveGameDisplayProps {
  gameData: CurrentGameInfo;
  onPlayerClick: (name: string, tag: string) => void;
}

const LiveGameDisplay: React.FC<LiveGameDisplayProps> = ({ gameData, onPlayerClick }) => {
  const communityDragonUrl = useDataDragonStore(state => state.communityDragonUrl);
  const championMap = useDataDragonStore(state => state.championMap);
  const fetchChampionData = useDataDragonStore(state => state.fetchChampionData);
  
  const [elapsedTime, setElapsedTime] = useState(gameData.gameLength);

  useEffect(() => {
    fetchChampionData();
  }, [fetchChampionData]);

  useEffect(() => {
    setElapsedTime(gameData.gameLength);
    const interval = setInterval(() => {
        setElapsedTime(prev => {
            if (prev >= 99 * 60) return prev;
            return prev + 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameData.gameLength]);

  const getRoleScore = (participant: CurrentGameParticipant, role: string): number => {
    let score = 0;
    const champion = championMap ? championMap[participant.championId.toString()] : null;
    const spells = [participant.spell1Id, participant.spell2Id];

    // Jungle: Smite (11)
    if (role === 'JUNGLE') {
        if (spells.includes(11)) score += 100;
    } else {
        // Penalty for having smite in lane
        if (spells.includes(11)) score -= 100;
    }

    // Support: Tag "Support", Spells Exhaust (3) / Ignite (14)
    if (role === 'SUPPORT') {
        if (champion?.tags.includes('Support')) score += 20;
        if (spells.includes(3)) score += 10; // Exhaust
        if (spells.includes(14) && !spells.includes(11)) score += 5; // Ignite
    }

    // Bot: Tag "Marksman", Spells Heal (7) / Cleanse (1)
    if (role === 'BOTTOM') {
        if (champion?.tags.includes('Marksman')) score += 20;
        if (spells.includes(7)) score += 10; // Heal
        if (spells.includes(1)) score += 10; // Cleanse
    }

    // Mid: Tag "Mage"/"Assassin", Spells Teleport (12) / Ignite (14)
    if (role === 'MIDDLE') {
        if (champion?.tags.includes('Mage') || champion?.tags.includes('Assassin')) score += 20;
        if (spells.includes(12)) score += 5; // TP
        if (spells.includes(14)) score += 5; // Ignite
    }

    // Top: Tag "Fighter"/"Tank", Spells Teleport (12) / Ghost (6)
    if (role === 'TOP') {
        if (champion?.tags.includes('Fighter') || champion?.tags.includes('Tank')) score += 20;
        if (spells.includes(12)) score += 10; // TP
        if (spells.includes(6)) score += 5; // Ghost
    }

    return score;
  };

  const sortTeam = (participants: CurrentGameParticipant[]) => {
    if (!championMap || participants.length !== 5) return participants;

    const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];
    
    // Recursive solver to find best permutation
    const solve = (
        currentParticipants: CurrentGameParticipant[], 
        roleIndex: number
    ): { score: number, assignment: CurrentGameParticipant[] } => {
        if (roleIndex === 5) {
            return { score: 0, assignment: [] };
        }
        
        const role = roles[roleIndex];
        let bestResult = { score: -Infinity, assignment: [] as CurrentGameParticipant[] };
        
        for (let i = 0; i < currentParticipants.length; i++) {
            const p = currentParticipants[i];
            const score = getRoleScore(p, role);
            const remaining = [...currentParticipants];
            remaining.splice(i, 1);
            
            const result = solve(remaining, roleIndex + 1);
            const totalScore = score + result.score;

            if (totalScore > bestResult.score) {
                bestResult = { score: totalScore, assignment: [p, ...result.assignment] };
            }
        }
        return bestResult;
    };

    const result = solve(participants, 0);
    return result.assignment.length === 5 ? result.assignment : participants;
  };

  const blueTeam = sortTeam(gameData.participants.filter((p) => p.teamId === 100));
  const redTeam = sortTeam(gameData.participants.filter((p) => p.teamId === 200));

  const blueBans = gameData.bannedChampions.filter(b => b.teamId === 100).sort((a, b) => a.pickTurn - b.pickTurn);
  const redBans = gameData.bannedChampions.filter(b => b.teamId === 200).sort((a, b) => a.pickTurn - b.pickTurn);

  const renderBans = (bans: BannedChampion[]) => (
      <div className="flex items-center space-x-1 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">Bans:</span>
          {bans.map(ban => (
              <img
                loading="lazy"
                  key={ban.pickTurn}
                  src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${ban.championId}.png`}
                  alt="Banned Champion"
                  className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 grayscale opacity-75"
                  title="Banned"
                   onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
                  }}
              />
          ))}
      </div>
  );

  const renderParticipant = (participant: CurrentGameParticipant, index: number) => {
    const displayName = participant.riotId || participant.summonerName || 'Unknown';
    const isClickable = participant.riotId && participant.riotId.includes('#');

    const handleClick = () => {
        if (isClickable && participant.riotId) {
            const [name, tag] = participant.riotId.split('#');
            if (name && tag) {
                onPlayerClick(name, tag);
            }
        }
    };

    let winrate = 0;
    let totalGames = 0;
    let winrateColor = 'text-slate-500 dark:text-slate-400';

    if (participant.wins !== undefined && participant.losses !== undefined) {
        totalGames = participant.wins + participant.losses;
        if (totalGames > 0) {
            winrate = Math.round((participant.wins / totalGames) * 100);
            winrateColor = getWinRateColorClass(winrate);
        }
    }

    return (
      <div 
        key={participant.puuid || `participant-${index}`} 
        className={`flex items-center space-x-3 mb-1.5 bg-white/90 dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 p-2 rounded-md transition-colors telemetry-nums ${isClickable ? 'cursor-pointer hover:border-sky-400 dark:hover:border-cyan-500/60' : ''}`}
        onClick={handleClick}
      >
        {/* Champion Icon */}
        <img
          loading="lazy"
          src={`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${participant.championId}.png`}
          alt="Champion"
          className="w-9 h-9 rounded-md border border-slate-300 dark:border-slate-700 shrink-0"
          onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/-1.png';
          }}
        />

        {/* Spells and Runes */}
        <div className="flex space-x-0.5 shrink-0">
            <div className="flex flex-col space-y-0.5">
                <SummonerSpellIcon spellId={participant.spell1Id} className="w-4 h-4 rounded" />
                <SummonerSpellIcon spellId={participant.spell2Id} className="w-4 h-4 rounded" />
            </div>
            <div className="flex flex-col space-y-0.5">
                <RuneIcon runeId={participant.perks.perkIds[0]} isKeystone={true} className="w-4 h-4 bg-slate-900/80 rounded-full p-0.5" />
                <RuneIcon runeId={participant.perks.perkSubStyle} className="w-4 h-4 bg-slate-900/80 rounded-full p-0.5" />
            </div>
        </div>
        
        {/* Name and Rank */}
        <div className="flex flex-col min-w-0">
            <div className={`text-xs font-bold truncate ${isClickable ? 'text-sky-600 dark:text-cyan-400 hover:underline' : 'text-slate-800 dark:text-slate-200'}`} title={displayName}>
            {displayName}
            </div>
            {participant.tier && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                    <img
                      loading="lazy"
                        src={`${communityDragonUrl}/rcp-fe-lol-shared-components/global/default/images/${participant.tier.toLowerCase()}.png`}
                        alt={participant.tier}
                        className="w-3.5 h-3.5"
                    />
                    <span className="font-medium">{participant.tier} {participant.rank} ({participant.leaguePoints} LP)</span>
                    {totalGames > 0 && (
                        <span className="hidden md:inline-flex items-center space-x-1">
                            <span className="text-slate-300 dark:text-slate-600 mx-1">|</span>
                            <span className={`font-bold ${winrateColor}`}>{winrate}% WR</span>
                            <span className="text-slate-400 dark:text-slate-500">({participant.wins}W {participant.losses}L)</span>
                        </span>
                    )}
                </div>
            )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-50 dark:bg-[#0b101d] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 mt-4 animate-fade-in telemetry-nums">
        <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Game <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 normal-case">(Ranked SoloQ)</span>
            </h3>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
            </span>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Blue Team */}
        <div className="bg-sky-50/50 dark:bg-sky-950/20 p-2.5 rounded-lg border border-sky-200/80 dark:border-sky-900/40">
          <div className="flex justify-between items-center mb-2">
              <h4 className="text-sky-600 dark:text-sky-400 font-extrabold text-xs uppercase tracking-wider">Blue Team</h4>
              {blueBans.length > 0 && renderBans(blueBans)}
          </div>
          {blueTeam.map(renderParticipant)}
        </div>

        {/* Red Team */}
        <div className="bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-200/80 dark:border-rose-900/40">
          <div className="flex justify-between items-center mb-2">
              <h4 className="text-rose-600 dark:text-rose-400 font-extrabold text-xs uppercase tracking-wider">Red Team</h4>
              {redBans.length > 0 && renderBans(redBans)}
          </div>
          {redTeam.map(renderParticipant)}
        </div>
      </div>
    </div>
  );
};

export default LiveGameDisplay;
