import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RecentChampionStats from './RecentChampionStats';
import MatchHistory from './MatchHistory';
import { calculateAverageLaneCsAt10, calculateStatsFromMatches } from '../utils/statsCalculator';
import type { MatchDto } from '../types/match';

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(() => 'https://ddragon.leagueoflegends.com/cdn/16.22.1'),
}));

vi.mock('./MatchHistoryItem', () => ({
  default: ({ match }: { match: MatchDto }) => (
    <div data-testid="mock-match-item">{match.metadata?.matchId ?? 'match'}</div>
  ),
}));

function buildListedMatch(options: {
  matchId: string;
  puuid: string;
  role: string;
  gameVersion?: string;
  laneMinionsFirst10Minutes?: number;
}): MatchDto {
  return {
    metadata: { matchId: options.matchId },
    info: {
      gameId: Number(options.matchId.replace(/\D/g, '')) || 1,
      gameDuration: 1800,
      gameVersion: options.gameVersion,
      participants: [
        {
          puuid: options.puuid,
          championName: 'Orianna',
          teamId: 100,
          teamPosition: options.role,
          win: true,
          kills: 5,
          deaths: 2,
          assists: 7,
          totalMinionsKilled: 200,
          neutralMinionsKilled: 12,
          challenges:
            options.laneMinionsFirst10Minutes !== undefined
              ? { laneMinionsFirst10Minutes: options.laneMinionsFirst10Minutes }
              : {},
        },
        {
          puuid: 'opp-puuid',
          championName: 'Syndndra',
          teamId: 200,
          teamPosition: options.role,
          win: false,
          kills: 2,
          deaths: 5,
          assists: 3,
          totalMinionsKilled: 180,
          neutralMinionsKilled: 4,
          challenges: { laneMinionsFirst10Minutes: 74 },
        },
      ],
    },
  };
}

describe('RecentChampionStats & Average Lane CS@10 (#12 follow-up)', () => {
  it('calculates and displays Avg Tower Plates', () => {
    const mockChampionStats = [{
        championName: 'Aatrox',
        games: 2,
        wins: 1,
        losses: 1,
        kills: 10,
        deaths: 4,
        assists: 20,
        cs: 400,
        averageCsPerMinute: 8.0,
        averageSoloKills: 1.0,
        averageTurretPlates: 3.0, // (2+4)/2
        averageKills: 5.0,
        averageDeaths: 2.0,
        averageAssists: 10.0,
        winRate: 50,
        kda: 7.5,
        soloKills: 2,
        turretPlates: 6,
        totalDamageDealt: 10000,
        damagePerMinute: 500,
        goldEarned: 20000,
        goldPerMinute: 400,
        visionScore: 20,
        visionScorePerMinute: 1.0
    }];

    const mockOverallStats = {
        wins: 1,
        losses: 1,
        winRate: 50,
        kda: 7.5,
        avgKills: 5,
        avgDeaths: 2,
        avgAssists: 10,
        avgCsPerMinute: 8.0,
        avgVisionScore: 10,
        avgSoloKills: 1.0,
        avgTurretPlates: 3.0,
        avgKillParticipation: 50,
        blueSide: { games: 1, wins: 1, winRate: 100 },
        redSide: { games: 1, wins: 0, winRate: 0 },
        oppAvgKda: 0,
        oppAvgKillParticipation: 0,
        oppAvgCsPerMinute: 0,
        oppAvgSoloKills: 0,
        oppAvgTurretPlates: 0,
        oppAvgVisionScore: 0
    };

    render(<RecentChampionStats championStats={mockChampionStats} overallStats={mockOverallStats} />);

    // Check for the label
    expect(screen.getByText('Avg Tower Plates:')).toBeInTheDocument();
    
    // Check for the value
    expect(screen.getByText('3.0')).toBeInTheDocument();
  });

  it('calculates and displays Opponent Stats', () => {
    const mockChampionStats: any[] = [];
    const mockOverallStats = {
        wins: 1,
        losses: 0,
        winRate: 100,
        kda: 7.5,
        avgKills: 5,
        avgDeaths: 2,
        avgAssists: 10,
        avgCsPerMinute: 6.6, // 200 / 30
        avgVisionScore: 0,
        avgSoloKills: 1.0,
        avgTurretPlates: 2.0,
        avgKillParticipation: 50,
        blueSide: { games: 1, wins: 1, winRate: 100 },
        redSide: { games: 0, wins: 0, winRate: 0 },
        oppAvgKda: 0.8, // (2+2)/5
        oppAvgKillParticipation: 0,
        oppAvgCsPerMinute: 5.0, // 150 / 30
        oppAvgSoloKills: 0,
        oppAvgTurretPlates: 0,
        oppAvgVisionScore: 0
    };

    render(<RecentChampionStats championStats={mockChampionStats} overallStats={mockOverallStats} />);

    // Check for Opponent Stats Labels/Values
    expect(screen.getByText(/0.80/)).toBeInTheDocument(); 
    expect(screen.getByText(/5.0/)).toBeInTheDocument();
  });

  it('computes average lane CS@10 across listed games for laners only, never counting missing laneMinionsFirst10Minutes as 0, and restricts ceiling average to 26.1+ games', () => {
    const puuid = 'player-1';
    const matches: MatchDto[] = [
      // 1) Post-26.1 MID game with 84 CS@10 -> included in actual (84) and ceiling (120)
      buildListedMatch({
        matchId: 'EUW1_1',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 84,
      }),
      // 2) Post-26.1 TOP game with 76 CS@10 -> included in actual (76) and ceiling (120)
      buildListedMatch({
        matchId: 'EUW1_2',
        puuid,
        role: 'TOP',
        gameVersion: '16.5.1',
        laneMinionsFirst10Minutes: 76,
      }),
      // 3) Pre-26.1 BOTTOM game with 80 CS@10 -> included in actual (80), excluded from 26.1+ ceiling
      buildListedMatch({
        matchId: 'EUW1_3',
        puuid,
        role: 'BOTTOM',
        gameVersion: '15.24.1',
        laneMinionsFirst10Minutes: 80,
      }),
      // 4) Post-26.1 MID game missing laneMinionsFirst10Minutes -> MUST NOT be counted as 0
      buildListedMatch({
        matchId: 'EUW1_4',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: undefined,
      }),
      // 5) Post-26.1 JUNGLE game with laneMinionsFirst10Minutes -> non-laner, excluded
      buildListedMatch({
        matchId: 'EUW1_5',
        puuid,
        role: 'JUNGLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 14,
      }),
      // 6) Post-26.1 UTILITY game with laneMinionsFirst10Minutes -> non-laner, excluded
      buildListedMatch({
        matchId: 'EUW1_6',
        puuid,
        role: 'UTILITY',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 18,
      }),
    ];

    const summary = calculateAverageLaneCsAt10(matches, puuid);
    expect(summary).toEqual({
      avgActual: 80, // (84 + 76 + 80) / 3 = 80.0 (missing game #4 NOT counted as 0!)
      matchCount: 3,
      avgSpawnedSupply: 120, // (120 + 120) / 2 from games #1 and #2 only
      ceilingMatchCount: 2,
      supplyLabel: 'Theoretical spawned supply (not guaranteed farmable)',
    });

    const { championStats, overallStats } = calculateStatsFromMatches(matches, puuid);
    expect(overallStats?.avgLaneCsAt10).toEqual(summary);

    const { unmount } = render(
      <RecentChampionStats championStats={championStats} overallStats={overallStats} />
    );
    const recentAvgRow = screen.getByTestId('avg-lane-cs-10');
    expect(recentAvgRow).toHaveTextContent('Avg CS@10 (3G):');
    expect(recentAvgRow).toHaveTextContent('80.0');
    expect(recentAvgRow).toHaveTextContent('/ 120 spawned*');
    expect(recentAvgRow).toHaveAttribute(
      'title',
      'Average lane-only CS @ 10:00 across 3 laner games: 80.0 last-hit / 120 theoretical spawned supply (2 patch 26.1+ games; not guaranteed farmable)'
    );
    unmount();

    render(
      <MatchHistory
        puuid={puuid}
        matches={matches}
        onPlayerClick={() => {}}
        onLoadMore={() => {}}
        hasMore={false}
        loadingMore={false}
        region="euw1"
      />
    );
    const banner = screen.getByTestId('match-history-avg-lane-cs-10');
    expect(banner).toHaveTextContent('Avg Lane CS@10 (3 games):');
    expect(banner).toHaveTextContent('80.0');
    expect(banner).toHaveTextContent('/ 120 spawned*');
    expect(banner).toHaveTextContent(
      '*Theoretical spawned supply (2 patch 26.1+ games), not guaranteed farmable'
    );
  });

  it('omits the ceiling when all eligible laner games are pre-26.1 and returns null when no laner games have laneMinionsFirst10Minutes', () => {
    const puuid = 'player-1';
    const pre26Matches: MatchDto[] = [
      buildListedMatch({
        matchId: 'EUW1_10',
        puuid,
        role: 'MIDDLE',
        gameVersion: '15.24.1',
        laneMinionsFirst10Minutes: 75,
      }),
      buildListedMatch({
        matchId: 'EUW1_11',
        puuid,
        role: 'TOP',
        gameVersion: '15.23.1',
        laneMinionsFirst10Minutes: 82,
      }),
    ];

    const pre26Summary = calculateAverageLaneCsAt10(pre26Matches, puuid);
    expect(pre26Summary).toEqual({
      avgActual: 78.5,
      matchCount: 2,
      avgSpawnedSupply: null,
      ceilingMatchCount: 0,
      supplyLabel: null,
    });

    const { unmount } = render(
      <MatchHistory
        puuid={puuid}
        matches={pre26Matches}
        onPlayerClick={() => {}}
        onLoadMore={() => {}}
        hasMore={false}
        loadingMore={false}
        region="euw1"
      />
    );
    const banner = screen.getByTestId('match-history-avg-lane-cs-10');
    expect(banner).toHaveTextContent('Avg Lane CS@10 (2 games):');
    expect(banner).toHaveTextContent('78.5');
    expect(banner).not.toHaveTextContent('120');
    expect(banner).not.toHaveTextContent('spawned');
    unmount();

    // Jungle + missing laneMinionsFirst10Minutes only -> returns null, no banner rendered
    const nonEligibleMatches: MatchDto[] = [
      buildListedMatch({
        matchId: 'EUW1_12',
        puuid,
        role: 'JUNGLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 15,
      }),
      buildListedMatch({
        matchId: 'EUW1_13',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: undefined,
      }),
    ];

    expect(calculateAverageLaneCsAt10(nonEligibleMatches, puuid)).toBeNull();
    render(
      <MatchHistory
        puuid={puuid}
        matches={nonEligibleMatches}
        onPlayerClick={() => {}}
        onLoadMore={() => {}}
        hasMore={false}
        loadingMore={false}
        region="euw1"
      />
    );
    expect(screen.queryByTestId('match-history-avg-lane-cs-10')).not.toBeInTheDocument();
  });
});
