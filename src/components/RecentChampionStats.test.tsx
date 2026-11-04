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
  gameDuration?: number;
  gameMode?: string;
  queueId?: number;
  gameEndedInEarlySurrender?: boolean;
}): MatchDto {
  return {
    metadata: { matchId: options.matchId },
    info: {
      gameId: Number(options.matchId.replace(/\D/g, '')) || 1,
      gameDuration: options.gameDuration !== undefined ? options.gameDuration : 1800,
      gameMode: options.gameMode,
      queueId: options.queueId,
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
          gameEndedInEarlySurrender: options.gameEndedInEarlySurrender,
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

  it('shows ceiling (120 spawned*) when all eligible laner games are on Patch 26.1+ and excludes missing, jungle, and support games', () => {
    const puuid = 'player-1';
    const matches: MatchDto[] = [
      // 1) Post-26.1 MID game with 84 CS@10 -> included in actual (84) and target (120)
      buildListedMatch({
        matchId: 'EUW1_1',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 84,
      }),
      // 2) Post-26.1 TOP game with 76 CS@10 -> included in actual (76) and target (114)
      buildListedMatch({
        matchId: 'EUW1_2',
        puuid,
        role: 'TOP',
        gameVersion: '16.5.1',
        laneMinionsFirst10Minutes: 76,
      }),
      // 3) Post-26.1 MID game missing laneMinionsFirst10Minutes -> MUST NOT be counted as 0
      buildListedMatch({
        matchId: 'EUW1_4',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: undefined,
      }),
      // 4) Post-26.1 JUNGLE game with laneMinionsFirst10Minutes -> non-laner, excluded
      buildListedMatch({
        matchId: 'EUW1_5',
        puuid,
        role: 'JUNGLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 14,
      }),
      // 5) Post-26.1 UTILITY game with laneMinionsFirst10Minutes -> support N/A, excluded
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
      avgActual: 80, // (84 + 76) / 2 = 80.0 (missing game #3 NOT counted as 0!)
      matchCount: 2,
      avgSupportedActual: 80,
      avgTarget: 117, // weighted over same 2 eligible games: (120 Mid + 114 Top) / 2 = 117
      targetMatchCount: 2,
      roleBreakdown: { TOP: 1, MIDDLE: 1, BOTTOM: 0 },
      targetLabel: '1 Mid, 1 Top',
    });

    const { championStats, overallStats } = calculateStatsFromMatches(matches, puuid);
    expect(overallStats?.avgLaneCsAt10).toEqual(summary);

    const { unmount } = render(
      <RecentChampionStats championStats={championStats} overallStats={overallStats} />
    );
    const recentAvgRow = screen.getByTestId('avg-lane-cs-10');
    expect(recentAvgRow).toHaveTextContent('Avg CS@10 (2G):');
    expect(recentAvgRow).toHaveTextContent('80.0');
    expect(recentAvgRow).toHaveTextContent('/ 117 target');
    expect(recentAvgRow).toHaveAttribute(
      'title',
      'Average lane-only CS @ 10:00 across 2 laner games: 80.0 last-hit / 117 target (1 Mid, 1 Top; Top/Bot 114, Mid 120)'
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
    expect(banner).toHaveTextContent('Avg Lane CS@10 (2 games):');
    expect(banner).toHaveTextContent('80.0');
    expect(banner).toHaveTextContent('/ 117 target');
    expect(banner).toHaveTextContent(
      'Lane target (1 Mid, 1 Top; Top/Bot 114, Mid 120)'
    );
  });

  it('computes weighted average target over the exact same eligible games (e.g. 12 Mid + 6 Top = 118) and excludes unknown roles, SUPPORT/UTILITY, and JUNGLE', () => {
    const puuid = 'player-1';
    const midMatches: MatchDto[] = Array.from({ length: 12 }, (_, idx) =>
      buildListedMatch({
        matchId: `EUW1_MID_${idx + 1}`,
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 90,
      })
    );
    const topMatches: MatchDto[] = Array.from({ length: 6 }, (_, idx) =>
      buildListedMatch({
        matchId: `EUW1_TOP_${idx + 1}`,
        puuid,
        role: 'TOP',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 81,
      })
    );
    const excludedRoleMatches: MatchDto[] = [
      buildListedMatch({
        matchId: 'EUW1_UNKNOWN_EMPTY',
        puuid,
        role: '',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 75,
      }),
      buildListedMatch({
        matchId: 'EUW1_UNKNOWN_NONE',
        puuid,
        role: 'NONE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 70,
      }),
      buildListedMatch({
        matchId: 'EUW1_SUPPORT_ROLE',
        puuid,
        role: 'SUPPORT',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 20,
      }),
      buildListedMatch({
        matchId: 'EUW1_JUNGLE_ROLE',
        puuid,
        role: 'JUNGLE',
        gameVersion: '16.22.1',
        laneMinionsFirst10Minutes: 12,
      }),
    ];

    const summary = calculateAverageLaneCsAt10(
      [...midMatches, ...topMatches, ...excludedRoleMatches],
      puuid
    );
    // Actual avg: (12 * 90 + 6 * 81) / 18 = (1080 + 486) / 18 = 87.0
    // Target avg: (12 * 120 + 6 * 114) / 18 = (1440 + 684) / 18 = 2124 / 18 = 118.0
    expect(summary).toEqual({
      avgActual: 87,
      matchCount: 18,
      avgSupportedActual: 87,
      avgTarget: 118,
      targetMatchCount: 18,
      roleBreakdown: { TOP: 6, MIDDLE: 12, BOTTOM: 0 },
      targetLabel: '12 Mid, 6 Top',
    });
  });

  it('suppresses target for mixed-patch subsets (never pairing all-patch actual avg with a subset target denominator) and rejects <600s duration, missing/nonfinite duration, non-SR queues, and negative CS', () => {
    const puuid = 'player-1';
    const mixedAndInvalidMatches: MatchDto[] = [
      // Valid 26.1+ Ranked Solo (420) game: 88 CS@10
      buildListedMatch({
        matchId: 'EUW1_101',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        queueId: 420,
        gameMode: 'CLASSIC',
        gameDuration: 1800,
        laneMinionsFirst10Minutes: 88,
      }),
      // Valid pre-26.1 Ranked Flex (440) game: 72 CS@10 -> makes this a mixed-patch subset (1 of 2 is 26.1+)
      buildListedMatch({
        matchId: 'EUW1_102',
        puuid,
        role: 'TOP',
        gameVersion: '15.24.1',
        queueId: 440,
        gameMode: 'CLASSIC',
        gameDuration: 1650,
        laneMinionsFirst10Minutes: 72,
      }),
      // Invalid: duration < 600s (e.g. 599s remake/early termination) -> REJECTED
      buildListedMatch({
        matchId: 'EUW1_103',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        gameDuration: 599,
        laneMinionsFirst10Minutes: 12,
      }),
      // Invalid: missing duration (undefined) -> REJECTED
      {
        metadata: { matchId: 'EUW1_104' },
        info: {
          gameId: 104,
          gameDuration: undefined,
          gameVersion: '16.22.1',
          participants: [
            {
              puuid,
              championName: 'Orianna',
              teamId: 100,
              teamPosition: 'MIDDLE',
              challenges: { laneMinionsFirst10Minutes: 50 },
            },
          ],
        },
      },
      // Invalid: non-finite duration (NaN) -> REJECTED
      buildListedMatch({
        matchId: 'EUW1_105',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        gameDuration: Number.NaN,
        laneMinionsFirst10Minutes: 50,
      }),
      // Invalid: ARAM queue (queueId 450) -> REJECTED
      buildListedMatch({
        matchId: 'EUW1_106',
        puuid,
        role: 'MIDDLE',
        gameVersion: '16.22.1',
        queueId: 450,
        gameMode: 'ARAM',
        gameDuration: 1200,
        laneMinionsFirst10Minutes: 40,
      }),
      // Invalid: unsupported queueId (Arena 1700) even if gameMode omitted -> REJECTED
      buildListedMatch({
        matchId: 'EUW1_107',
        puuid,
        role: 'TOP',
        gameVersion: '16.22.1',
        queueId: 1700,
        gameDuration: 1200,
        laneMinionsFirst10Minutes: 0,
      }),
      // Invalid: negative laneMinionsFirst10Minutes (-5) -> REJECTED
      buildListedMatch({
        matchId: 'EUW1_108',
        puuid,
        role: 'BOTTOM',
        gameVersion: '16.22.1',
        gameDuration: 1800,
        laneMinionsFirst10Minutes: -5,
      }),
    ];

    const summary = calculateAverageLaneCsAt10(mixedAndInvalidMatches, puuid);
    expect(summary).toEqual({
      avgActual: 80, // (88 + 72) / 2 across the 2 valid SR laner games
      matchCount: 2,
      avgSupportedActual: 88, // 26.1+ supported subset actual average is tracked separately
      avgTarget: null, // Suppressed because targetMatchCount (1) !== matchCount (2)
      targetMatchCount: 1,
      roleBreakdown: { TOP: 1, MIDDLE: 1, BOTTOM: 0 },
      targetLabel: null,
    });

    const { championStats, overallStats } = calculateStatsFromMatches(mixedAndInvalidMatches, puuid);
    const { unmount } = render(
      <RecentChampionStats championStats={championStats} overallStats={overallStats} />
    );
    const recentAvgRow = screen.getByTestId('avg-lane-cs-10');
    expect(recentAvgRow).toHaveTextContent('Avg CS@10 (2G):');
    expect(recentAvgRow).toHaveTextContent('80.0');
    expect(recentAvgRow).not.toHaveTextContent('120');
    expect(recentAvgRow).not.toHaveTextContent('target');
    unmount();

    render(
      <MatchHistory
        puuid={puuid}
        matches={mixedAndInvalidMatches}
        onPlayerClick={() => {}}
        onLoadMore={() => {}}
        hasMore={false}
        loadingMore={false}
        region="euw1"
      />
    );
    const banner = screen.getByTestId('match-history-avg-lane-cs-10');
    expect(banner).toHaveTextContent('Avg Lane CS@10 (2 games):');
    expect(banner).toHaveTextContent('80.0');
    expect(banner).not.toHaveTextContent('120');
    expect(banner).not.toHaveTextContent('target');
  });

  it('omits the target when all eligible laner games are pre-26.1 and returns null when no laner games have laneMinionsFirst10Minutes', () => {
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
      avgSupportedActual: null,
      avgTarget: null,
      targetMatchCount: 0,
      roleBreakdown: { TOP: 1, MIDDLE: 1, BOTTOM: 0 },
      targetLabel: null,
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
    expect(banner).not.toHaveTextContent('target');
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
