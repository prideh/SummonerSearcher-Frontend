import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CHECKPOINT_TOLERANCE_MS,
  MAX_RECENT_PLAYER_MATCHES,
  buildSearchedPlayerProComparison,
  clearSharedProTimelineCacheForTests,
  extractPlayerMatchSummary,
  extractPlayerWholeGameMetrics,
  resolvePlayerMatchParticipant,
  resolveTimelineParticipantIdByPuuid,
  resolveValidatedMatchSortTimestampMs,
  sharedTimelineCache,
} from './searchedPlayerProAdapter';
import { ProfileProComparisonTab } from './ProfileProComparisonTab';
import { RECORDED_REVIEW_PROFILES } from './recordedPlayerContractSample';
import ProComparisonPreview from './ProComparisonPreview';
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  computeExactProTeamKillParticipation,
  computeProComparisonSlice,
  formatChampionDisplayName,
  listSelectableProPlayers,
  resolveSelectableProPlayer,
} from './proBenchmarkEngine';
import * as timelineApi from '../../api/timeline';
import apiClient from '../../api/apiClient';
import type { MatchDto } from '../../types/match';
import type { MatchTimelineDto } from '../../types/timeline';

describe('searchedPlayerProAdapter & ProfileProComparisonTab contract suite', () => {
  beforeEach(() => {
    clearSharedProTimelineCacheForTests();
  });

  it('resolves participant strictly by PUUID and explicit matchId, never by array index, and rejects mismatched timelines', () => {
    const profile = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const match1 = profile.visibleMatches[0]; // EUW1_7201001 where searched player is at index 1 with participantId 6

    const resolvedParticipant = resolvePlayerMatchParticipant(match1, profile.puuid);
    expect(resolvedParticipant?.participantId).toBe(6);
    expect(resolvedParticipant?.championName).toBe('KSante');

    const timeline1 = profile.timelinesByMatchId.EUW1_7201001;
    expect(
      resolveTimelineParticipantIdByPuuid(timeline1, profile.puuid, resolvedParticipant!)
    ).toBe(6);

    // Rejects timeline belonging to a different PUUID set
    expect(
      resolveTimelineParticipantIdByPuuid(timeline1, 'wrong-puuid-999', resolvedParticipant!)
    ).toBeNull();

    // Rejects timeline with mismatched metadata.matchId
    const wrongMatchIdSummary = extractPlayerMatchSummary(match1, profile.puuid, {
      EUW1_7201001: {
        ...timeline1,
        metadata: {
          matchId: 'EUW1_DIFFERENT_MATCH',
          participants: [profile.puuid],
        },
      },
    });
    expect(wrongMatchIdSummary?.timelineStatus).toBe('mismatched_match_id');
    expect(wrongMatchIdSummary?.checkpoints[10].status).toBe('timeline_not_loaded');
    expect(wrongMatchIdSummary?.checkpoints[10].totalCs).toBeNull();
  });

  it('extracts raw timestamped lane+jungle counters within ±30s tolerance and strictly rejects missing/null counters or out-of-tolerance floored frames', () => {
    const puuid = 'puuid-strict-test';
    const matchDto: MatchDto = {
      metadata: { matchId: 'EUW1_9001', participants: [puuid] },
      info: {
        gameId: 9001,
        gameDuration: 1500, // 25:00
        gameMode: 'CLASSIC',
        gameVersion: '16.22.1',
        queueId: 420,
        participants: [
          {
            participantId: 4,
            puuid,
            championName: 'KSante',
            teamPosition: 'TOP',
            win: true,
            totalMinionsKilled: 200,
            neutralMinionsKilled: 12,
          },
        ],
      },
    };

    const timelineDto: MatchTimelineDto = {
      metadata: { matchId: 'EUW1_9001', participants: [puuid] },
      info: {
        frameInterval: 60_000,
        participants: [{ participantId: 4, puuid, championName: 'KSante' }],
        frames: [
          // 5m: within +12s tolerance (312,000ms) -> valid (36 lane + 4 jungle = 40 CS)
          {
            timestamp: 5 * 60_000 + 12_000,
            participantFrames: {
              '4': {
                participantId: 4,
                totalGold: 1800,
                level: 5,
                xp: 2000,
                currentGold: 300,
                minionsKilled: 36,
                jungleMinionsKilled: 4,
                position: { x: 1000, y: 1000 },
              },
            },
            events: [],
          },
          // 10m: jungleMinionsKilled is null -> must be 'missing_counter' (never default null to 0!)
          {
            timestamp: 10 * 60_000,
            participantFrames: {
              '4': {
                participantId: 4,
                totalGold: 3500,
                level: 8,
                xp: 4200,
                currentGold: 500,
                minionsKilled: 85,
                jungleMinionsKilled: null,
                position: { x: 1000, y: 1000 },
              },
            },
            events: [],
          },
          // 15m: timestamp is 15:49 (949,000ms) which floors to minute 15 in lossy powerSpike,
          // but exceeds ±30s tolerance (CHECKPOINT_TOLERANCE_MS = 30,000) -> must be 'missing_frame'
          {
            timestamp: 15 * 60_000 + 49_000,
            participantFrames: {
              '4': {
                participantId: 4,
                totalGold: 5200,
                level: 11,
                xp: 6800,
                currentGold: 400,
                minionsKilled: 140,
                jungleMinionsKilled: 8,
                position: { x: 1000, y: 1000 },
              },
            },
            events: [],
          },
          // 20m: exact 20:00 frame -> valid (170 lane + 8 jungle = 178 CS)
          {
            timestamp: 20 * 60_000,
            participantFrames: {
              '4': {
                participantId: 4,
                totalGold: 7200,
                level: 13,
                xp: 9500,
                currentGold: 600,
                minionsKilled: 170,
                jungleMinionsKilled: 8,
                position: { x: 1000, y: 1000 },
              },
            },
            events: [],
          },
        ],
      },
    };

    expect(CHECKPOINT_TOLERANCE_MS).toBe(30_000);
    const summary = extractPlayerMatchSummary(matchDto, puuid, { EUW1_9001: timelineDto });
    expect(summary).not.toBeNull();

    // 5m: valid (36 + 4 = 40)
    expect(summary!.checkpoints[5].status).toBe('available');
    expect(summary!.checkpoints[5].totalCs).toBe(40);
    expect(summary!.checkpoints[5].laneCs).toBe(36);
    expect(summary!.checkpoints[5].jungleCs).toBe(4);

    // 10m: null jungleMinionsKilled -> missing_counter, never 85 + 0 = 85
    expect(summary!.checkpoints[10].status).toBe('missing_counter');
    expect(summary!.checkpoints[10].totalCs).toBeNull();

    // 15m: +49s frame is outside ±30s tolerance -> missing_frame
    expect(summary!.checkpoints[15].status).toBe('missing_frame');
    expect(summary!.checkpoints[15].totalCs).toBeNull();

    // 20m: valid (170 + 8 = 178)
    expect(summary!.checkpoints[20].status).toBe('available');
    expect(summary!.checkpoints[20].totalCs).toBe(178);

    // 30m: game ended at 25:00 (1500s < 1800s) -> game_ended_before_checkpoint, never 0
    expect(summary!.checkpoints[30].status).toBe('game_ended_before_checkpoint');
    expect(summary!.checkpoints[30].totalCs).toBeNull();
  });

  it('computes player mean Total CS, denominators, short-game exclusions, and same champion+role pro comparison accurately', () => {
    const profile = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const view = buildSearchedPlayerProComparison({
      identity: {
        puuid: profile.puuid,
        region: profile.region,
        gameName: profile.gameName,
        tagLine: profile.tagLine,
      },
      visibleMatches: profile.visibleMatches,
      timelinesByMatchId: profile.timelinesByMatchId,
    });

    expect(view.selectedPair?.pairKey).toBe('top::KSante');
    expect(view.selectedPair?.playerGameCount).toBe(2);
    expect(view.selectedPair?.proReferenceAvailable).toBe(true);
    expect(view.selectedPair?.proSampleGameCount).toBe(3);

    // 10m: Match 1 (86+4=90) and Match 2 (84+0=84) -> Mean 87.0 CS (2/2G) vs Pro 93.0 CS (3/3G) -> Delta -6.0 CS
    const cp10 = view.checkpoints.find((c) => c.minute === 10)!;
    expect(cp10.playerGamesReached).toBe(2);
    expect(cp10.playerTotalGames).toBe(2);
    expect(cp10.playerMeanTotalCs).toBe(87.0);
    expect(cp10.proMeanTotalCs).toBe(93.0);
    expect(cp10.proGamesReached).toBe(3);
    expect(cp10.deltaTotalCs).toBe(-6.0);

    // 25m: Match 2 ended at 23:00, so only Match 1 (206+12=218) reached 25m -> 1/2G Player vs 3/3G Pro (223.0) -> Delta -5.0 CS
    const cp25 = view.checkpoints.find((c) => c.minute === 25)!;
    expect(cp25.playerGamesReached).toBe(1);
    expect(cp25.playerTotalGames).toBe(2);
    expect(cp25.playerShortGamesExcluded).toBe(1);
    expect(cp25.playerMeanTotalCs).toBe(218.0);
    expect(cp25.proMeanTotalCs).toBe(223.0);
    expect(cp25.deltaTotalCs).toBe(-5.0);

    // 30m: Match 1 reached 30m (242+16=258.0 CS, 1/2G), while Pro 30m is not in sample export -> proMeanTotalCs: null, deltaTotalCs: null
    const cp30 = view.checkpoints.find((c) => c.minute === 30)!;
    expect(cp30.playerGamesReached).toBe(1);
    expect(cp30.playerMeanTotalCs).toBe(258.0);
    expect(cp30.proStatus).toBe('not_in_sample_export');
    expect(cp30.proMeanTotalCs).toBeNull();
    expect(cp30.deltaTotalCs).toBeNull();
  });

  it('renders unsupported champion-role honestly with no pro comparison and never substitutes an unrelated fallback', () => {
    const profile = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    render(
      <ProfileProComparisonTab
        puuid={profile.puuid}
        region={profile.region}
        gameName={profile.gameName}
        tagLine={profile.tagLine}
        visibleMatches={profile.visibleMatches}
        initialTimelinesByMatchId={profile.timelinesByMatchId}
        dataSourceMode="synthetic_test_profile"
      />
    );

    // Switch to Top · Garen (which has 0 games in the 8-game Worlds 2026 sample)
    fireEvent.change(screen.getByTestId('player-pair-select'), {
      target: { value: 'top::Garen' },
    });

    expect(screen.getByTestId('unsupported-pro-pair-badge')).toHaveTextContent(
      'No Pro Reference in 8-Game Sample (0G for Garen · Top)'
    );
    expect(screen.getByTestId('unsupported-pair-banner')).toHaveTextContent(
      'No Pro Reference for Garen · Top'
    );

    // Player's own CS at 10m (78.0 CS) is still shown, but Pro Ref is 'No Pro Sample' and Delta is 'No Delta'
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('78.0');
    expect(screen.getByTestId('pro-unavailable-10m')).toHaveTextContent('No Pro Sample');
    expect(screen.getByTestId('paired-delta-10m')).toHaveTextContent('No Delta');
  });

  it('defaults to Ironclad#EUW (22G / recent20), retains legacy partial sample players as options preserving Unknown (never hidden or 0), and clears stale selection on switch', () => {
    render(<ProComparisonPreview initialSurface="profile" />);

    // Default sample player is Ironclad#EUW (22-match sample profile with full 5v5 teams)
    expect(screen.getByTestId('pro-comparison-identity-badge')).toHaveTextContent(
      'Ironclad#EUW (EUW1)'
    );
    expect(screen.getByTestId('pro-comparison-datasource-badge')).toHaveTextContent(
      'Sample player · Not real account data (Offline)'
    );
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent(
      'Top · All Top Champions'
    );
    expect(screen.getByTestId('recent20-window-strip')).toHaveTextContent(
      'Recent 20/20 Matches (2 older excluded)'
    );
    expect(screen.getByTestId('whole-game-player-killParticipation')).not.toHaveTextContent(
      'Unknown'
    );

    // Open Review Controls and switch to legacy partial-team fixture BladeRunner#EUW -> Unknown is preserved (never hidden or 0)
    fireEvent.click(screen.getByTestId('toggle-review-controls'));
    fireEvent.click(screen.getByTestId('switch-review-player-euw'));

    expect(screen.getByTestId('pro-comparison-identity-badge')).toHaveTextContent(
      'BladeRunner#EUW (EUW1)'
    );
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent(
      'Top · All Top Champions'
    );
    expect(screen.getByTestId('whole-game-player-killParticipation')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('whole-game-player-championDamageShare')).toHaveTextContent(
      'Unknown'
    );
    expect(screen.getByTestId('whole-game-player-totalDeaths')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('84.0');

    // Narrow to optional champion Top · K'Sante (underlying value remains top::KSante)
    fireEvent.change(screen.getByTestId('player-pair-select'), {
      target: { value: 'top::KSante' },
    });
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent("Top · K'Sante");
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('87.0');

    // Switch to individual match EUW1_7201001
    fireEvent.change(screen.getByTestId('player-match-scope-select'), {
      target: { value: 'EUW1_7201001' },
    });
    expect(screen.getByTestId('player-denom-10m')).toHaveTextContent('1/1G');
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('90.0');

    // Switch synthetic test profile to ArcaneWave#KR1 -> clears stale Top/KSante selection and binds to Role-First Mid
    fireEvent.click(screen.getByTestId('switch-review-player-kr'));
    expect(screen.getByTestId('pro-comparison-identity-badge')).toHaveTextContent(
      'ArcaneWave#KR1 (KR)'
    );
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent(
      'Mid · All Mid Champions'
    );
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('94.0');

    // Narrow to Mid · Syndra
    fireEvent.change(screen.getByTestId('player-pair-select'), {
      target: { value: 'mid::Syndra' },
    });
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent('Mid · Syndra');
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('94.0');
    expect(screen.getByTestId('pro-mean-cs-10m')).toHaveTextContent('96.0');
    expect(screen.getByTestId('paired-delta-10m')).toHaveTextContent('-2.0 CS');
  });

  it('does not auto-fetch timelines on mount and loads bounded timelines only when the user clicks Load Timelines', async () => {
    const profile = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const mockFetchTimeline = vi
      .fn()
      .mockImplementation(async (_region: string, matchId: string) => {
        return profile.timelinesByMatchId[matchId] ?? null;
      });

    render(
      <ProfileProComparisonTab
        puuid={profile.puuid}
        region={profile.region}
        gameName={profile.gameName}
        tagLine={profile.tagLine}
        visibleMatches={profile.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );

    // Must not auto-fetch on mount
    expect(mockFetchTimeline).not.toHaveBeenCalled();
    expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent('Load Timeline');

    // User clicks Load Timelines (2G for KSante · Top, not fetching the unrelated Garen match)
    const loadBtn = screen.getByTestId('load-pair-timelines-btn');
    expect(loadBtn).toHaveTextContent('Load Timelines (2G)');
    fireEvent.click(loadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('87.0');
    });
    expect(mockFetchTimeline).toHaveBeenCalledTimes(2);
    expect(mockFetchTimeline).toHaveBeenCalledWith('EUW1', 'EUW1_7201001');
    expect(mockFetchTimeline).toHaveBeenCalledWith('EUW1', 'EUW1_7201002');
  });

  it('invalidates in-flight timeline requests when switching from Player A to Player B and prevents stale completion from applying', async () => {
    const playerA = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const playerB = RECORDED_REVIEW_PROFILES.kr_mid_specialist;

    let resolvePlayerAMatch1!: (dto: MatchTimelineDto | null) => void;
    const playerAMatch1Promise = new Promise<MatchTimelineDto | null>((resolve) => {
      resolvePlayerAMatch1 = resolve;
    });

    const mockFetchTimeline = vi
      .fn()
      .mockImplementation((_region: string, matchId: string) => {
        if (matchId === 'EUW1_7201001') {
          return playerAMatch1Promise;
        }
        return Promise.resolve(
          playerA.timelinesByMatchId[matchId] ?? playerB.timelinesByMatchId[matchId] ?? null
        );
      });

    const { rerender } = render(
      <ProfileProComparisonTab
        puuid={playerA.puuid}
        region={playerA.region}
        gameName={playerA.gameName}
        tagLine={playerA.tagLine}
        visibleMatches={playerA.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );

    // No automatic fetch on mount
    expect(mockFetchTimeline).not.toHaveBeenCalled();

    // Start loading timelines on Player A (2G: EUW1_7201001 and EUW1_7201002)
    const loadBtnA = screen.getByTestId('load-pair-timelines-btn');
    expect(loadBtnA).toHaveTextContent('Load Timelines (2G)');
    fireEvent.click(loadBtnA);

    expect(mockFetchTimeline).toHaveBeenCalledTimes(1);
    expect(mockFetchTimeline).toHaveBeenCalledWith('EUW1', 'EUW1_7201001');
    expect(screen.getByTestId('load-pair-timelines-btn')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('load-pair-timelines-btn')).toBeDisabled();

    // Switch searched player to Player B while Player A's first timeline request is still pending
    rerender(
      <ProfileProComparisonTab
        puuid={playerB.puuid}
        region={playerB.region}
        gameName={playerB.gameName}
        tagLine={playerB.tagLine}
        visibleMatches={playerB.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );

    // Player B must NOT inherit Player A's loading state and must NOT auto-fetch
    expect(screen.getByTestId('profile-pro-comparison-tab')).toHaveAttribute(
      'data-bound-identity',
      'ArcaneWave#KR1 (KR)'
    );
    const loadBtnB = screen.getByTestId('load-pair-timelines-btn');
    expect(loadBtnB).toHaveTextContent('Load Timelines (1G)');
    expect(loadBtnB).not.toBeDisabled();
    expect(mockFetchTimeline).toHaveBeenCalledTimes(1);

    // Now resolve Player A's delayed request AFTER Player B is displayed
    await act(async () => {
      resolvePlayerAMatch1(playerA.timelinesByMatchId.EUW1_7201001);
      await Promise.resolve();
    });

    // Must not continue Player A's batch to EUW1_7201002, must not cache stale result, and must not alter Player B UI
    expect(mockFetchTimeline).toHaveBeenCalledTimes(1);
    expect(sharedTimelineCache.has('euw1::EUW1_7201001')).toBe(false);
    expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent('Load Timeline');
    expect(screen.queryByTestId('timeline-fetch-error')).not.toBeInTheDocument();

    // Even switching back to Player A must not show stale completion from the invalidated generation
    rerender(
      <ProfileProComparisonTab
        puuid={playerA.puuid}
        region={playerA.region}
        gameName={playerA.gameName}
        tagLine={playerA.tagLine}
        visibleMatches={playerA.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );
    expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent('Load Timeline');
    expect(screen.getByTestId('load-pair-timelines-btn')).toHaveTextContent('Load Timelines (2G)');
  });

  it('isolates loading and error states when an old request from Player A fails after Player B is displayed or loading', async () => {
    const playerA = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const playerB = RECORDED_REVIEW_PROFILES.kr_mid_specialist;

    let rejectPlayerAMatch1!: (err: Error) => void;
    const playerAMatch1Promise = new Promise<MatchTimelineDto | null>((_resolve, reject) => {
      rejectPlayerAMatch1 = reject;
    });

    let resolvePlayerBMatch1!: (dto: MatchTimelineDto | null) => void;
    const playerBMatch1Promise = new Promise<MatchTimelineDto | null>((resolve) => {
      resolvePlayerBMatch1 = resolve;
    });

    const mockFetchTimeline = vi
      .fn()
      .mockImplementation((_region: string, matchId: string) => {
        if (matchId === 'EUW1_7201001') {
          return playerAMatch1Promise;
        }
        if (matchId === 'KR_8102001') {
          return playerBMatch1Promise;
        }
        return Promise.resolve(null);
      });

    const { rerender } = render(
      <ProfileProComparisonTab
        puuid={playerA.puuid}
        region={playerA.region}
        gameName={playerA.gameName}
        tagLine={playerA.tagLine}
        visibleMatches={playerA.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );

    // Start Player A request
    fireEvent.click(screen.getByTestId('load-pair-timelines-btn'));
    expect(screen.getByTestId('load-pair-timelines-btn')).toHaveTextContent('Loading...');

    // Switch to Player B
    rerender(
      <ProfileProComparisonTab
        puuid={playerB.puuid}
        region={playerB.region}
        gameName={playerB.gameName}
        tagLine={playerB.tagLine}
        visibleMatches={playerB.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );

    // Start Player B request so Player B is actively loading
    fireEvent.click(screen.getByTestId('load-pair-timelines-btn'));
    expect(screen.getByTestId('load-pair-timelines-btn')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('load-pair-timelines-btn')).toBeDisabled();

    // Now Player A's old request rejects while Player B is loading
    await act(async () => {
      rejectPlayerAMatch1(new Error('Network timeout for Player A'));
      await Promise.resolve();
    });

    // Player B must NOT receive Player A's error and must STILL be in Loading... state
    expect(screen.queryByTestId('timeline-fetch-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('load-pair-timelines-btn')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('load-pair-timelines-btn')).toBeDisabled();

    // Resolve Player B's request and verify Player B completes cleanly
    await act(async () => {
      resolvePlayerBMatch1(playerB.timelinesByMatchId.KR_8102001);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('94.0');
    });
    expect(screen.queryByTestId('timeline-fetch-error')).not.toBeInTheDocument();
  });

  it('invalidates in-flight timeline requests on unmount and reports factual error message when current request fails', async () => {
    const playerA = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const playerB = RECORDED_REVIEW_PROFILES.kr_mid_specialist;

    let resolvePlayerAMatch1!: (dto: MatchTimelineDto | null) => void;
    const playerAMatch1Promise = new Promise<MatchTimelineDto | null>((resolve) => {
      resolvePlayerAMatch1 = resolve;
    });

    const mockFetchTimeline = vi
      .fn()
      .mockImplementation((_region: string, matchId: string) => {
        if (matchId === 'EUW1_7201001') {
          return playerAMatch1Promise;
        }
        return Promise.resolve(null);
      });

    const { unmount } = render(
      <ProfileProComparisonTab
        puuid={playerA.puuid}
        region={playerA.region}
        gameName={playerA.gameName}
        tagLine={playerA.tagLine}
        visibleMatches={playerA.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={mockFetchTimeline}
        initialScope="champion_pair"
      />
    );

    fireEvent.click(screen.getByTestId('load-pair-timelines-btn'));
    expect(mockFetchTimeline).toHaveBeenCalledTimes(1);

    // Unmount before promise resolves
    unmount();

    await act(async () => {
      resolvePlayerAMatch1(playerA.timelinesByMatchId.EUW1_7201001);
      await Promise.resolve();
    });

    // Second match in batch must never be fetched after unmount, and cache must not be written
    expect(mockFetchTimeline).toHaveBeenCalledTimes(1);
    expect(sharedTimelineCache.has('euw1::EUW1_7201001')).toBe(false);

    // Verify current-player failure message is factual and does not speculate about memory guards
    const failingFetch = vi.fn().mockResolvedValue(null);
    render(
      <ProfileProComparisonTab
        puuid={playerB.puuid}
        region={playerB.region}
        gameName={playerB.gameName}
        tagLine={playerB.tagLine}
        visibleMatches={playerB.visibleMatches}
        initialTimelinesByMatchId={{}}
        fetchTimeline={failingFetch}
        initialScope="champion_pair"
      />
    );

    fireEvent.click(screen.getByTestId('load-pair-timelines-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('timeline-fetch-error')).toHaveTextContent(
        'Could not load 1 of 1 match timeline(s). Please try again.'
      );
    });
    expect(screen.getByTestId('timeline-fetch-error').textContent).not.toContain('memory guard');
    expect(screen.getByTestId('timeline-fetch-error').textContent).not.toContain('endpoint');
  });

  it('computes Pro checkpoint Gold, Level, Champion-Role GD/CSD, Whole-Game KP/DMG%/Ward Rates, and excludes paused games from Early Total Deaths', () => {
    const ksanteSlice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'top',
      championId: 'KSante',
    });

    // 10m Gold: (4019 + 3578 + 3685) / 3 = 3760.7, Level: (9 + 8 + 9) / 3 = 8.7
    expect(ksanteSlice.checkpoints[10].availableGoldSnapshotCount).toBe(3);
    expect(ksanteSlice.checkpoints[10].meanTotalGold).toBe(3760.7);
    expect(ksanteSlice.checkpoints[10].minTotalGold).toBe(3578);
    expect(ksanteSlice.checkpoints[10].maxTotalGold).toBe(4019);
    expect(ksanteSlice.checkpoints[10].availableLevelSnapshotCount).toBe(3);
    expect(ksanteSlice.checkpoints[10].meanLevel).toBe(8.7);
    expect(ksanteSlice.checkpoints[10].minLevel).toBe(8);
    expect(ksanteSlice.checkpoints[10].maxLevel).toBe(9);

    // 10m Champion-Role Opponent Diffs: CSD = (19 + 7 + 3) / 3 = +9.7, GD = (1140 + 174 + 243) / 3 = +519.0
    expect(ksanteSlice.checkpoints[10].roleOpponentDiffStatus).toBe('AVAILABLE');
    expect(ksanteSlice.checkpoints[10].availableCsDiffCount).toBe(3);
    expect(ksanteSlice.checkpoints[10].meanCsDiffVsRoleOpponent).toBe(9.7);
    expect(ksanteSlice.checkpoints[10].minCsDiffVsRoleOpponent).toBe(3);
    expect(ksanteSlice.checkpoints[10].maxCsDiffVsRoleOpponent).toBe(19);
    expect(ksanteSlice.checkpoints[10].availableGoldDiffCount).toBe(3);
    expect(ksanteSlice.checkpoints[10].meanGoldDiffVsRoleOpponent).toBe(519.0);
    expect(ksanteSlice.checkpoints[10].minGoldDiffVsRoleOpponent).toBe(174);
    expect(ksanteSlice.checkpoints[10].maxGoldDiffVsRoleOpponent).toBe(1140);

    // Early Total Deaths @ 10m on KSante (all 3 games unpaused: 0, 1, 0 -> mean 0.33)
    expect(ksanteSlice.checkpoints[10].earlyTotalDeathsStatus).toBe('AVAILABLE');
    expect(ksanteSlice.checkpoints[10].earlyTotalDeathsPausedGamesExcludedCount).toBe(0);
    expect(ksanteSlice.checkpoints[10].earlyTotalDeathsAvailableCount).toBe(3);
    expect(ksanteSlice.checkpoints[10].meanEarlyTotalDeaths).toBe(0.33);

    // 25m Early Total Deaths: not in game.checkpoints export -> UNAVAILABLE (SNAPSHOT_NOT_EXPORTED_AT_MARK)
    expect(ksanteSlice.checkpoints[25].earlyTotalDeathsStatus).toBe('UNAVAILABLE');
    expect(ksanteSlice.checkpoints[25].earlyTotalDeathsUnavailableReason).toBe(
      'SNAPSHOT_NOT_EXPORTED_AT_MARK'
    );
    expect(ksanteSlice.checkpoints[25].meanEarlyTotalDeaths).toBeNull();

    // Whole-Game Summary for KSante: KP = 0.505, DMG% = 0.2231, WPM = 0.38, WCPM = 0.08
    expect(ksanteSlice.wholeGameSummary.totalSliceGames).toBe(3);
    expect(ksanteSlice.wholeGameSummary.killParticipation.availableCount).toBe(3);
    expect(ksanteSlice.wholeGameSummary.killParticipation.mean).toBe(0.505);
    expect(ksanteSlice.wholeGameSummary.championDamageShare.mean).toBe(0.2231);
    expect(ksanteSlice.wholeGameSummary.wardsPlacedPerMin.mean).toBe(0.38);
    expect(ksanteSlice.wholeGameSummary.wardsDestroyedPerMin.mean).toBe(0.08);

    // Mid · Syndra (3 games: IG vs TES G1 is paused 105.02s with D10=1; other 2 games unpaused with D10=0)
    const syndraSlice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'mid',
      championId: 'Syndra',
    });
    expect(syndraSlice.checkpoints[10].availableGoldSnapshotCount).toBe(3);
    expect(syndraSlice.checkpoints[10].meanTotalGold).toBe(3660.7);
    expect(syndraSlice.checkpoints[10].meanCsDiffVsRoleOpponent).toBe(-0.3);
    expect(syndraSlice.checkpoints[10].meanGoldDiffVsRoleOpponent).toBe(-189.7);

    // Unaligned checkpoints[m].from_spawn Early Total Deaths strictly excludes paused IG vs TES G1
    expect(syndraSlice.checkpoints[10].earlyTotalDeathsStatus).toBe('AVAILABLE');
    expect(syndraSlice.checkpoints[10].earlyTotalDeathsPausedGamesExcludedCount).toBe(1);
    expect(syndraSlice.checkpoints[10].earlyTotalDeathsAvailableCount).toBe(2);
    expect(syndraSlice.checkpoints[10].meanEarlyTotalDeaths).toBe(0);
    expect(syndraSlice.evidenceRows[0].gameId).toBe('115660540726095110');
    expect(syndraSlice.evidenceRows[0].checkpoints[10].earlyTotalDeathsExcludedByPause).toBe(true);
    expect(syndraSlice.evidenceRows[0].checkpoints[10].earlyTotalDeaths).toBeNull();

    // Role-only slice ('ALL' champions) suppresses Champion-Role GD/CSD
    const allTopSlice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'top',
      championId: 'ALL',
    });
    expect(allTopSlice.checkpoints[10].roleOpponentDiffStatus).toBe(
      'REQUIRES_CHAMPION_AND_ROLE_SLICE'
    );
    expect(allTopSlice.checkpoints[10].meanCsDiffVsRoleOpponent).toBeNull();
    expect(allTopSlice.checkpoints[10].meanGoldDiffVsRoleOpponent).toBeNull();

    // Dataset-wide slice ('ALL' roles, 'ALL' champions): conservative whole-game pause exclusion
    // excludes IG vs TES G1 (10 observations, total_pause_s = 105.02) at ALL checkpoints (including 5m),
    // so earlyTotalDeaths has 70 unpaused observations across 7 games at 5m, 10m, 14m, 15m, and 20m — NEVER 80!
    const fullDatasetSlice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'ALL',
      championId: 'ALL',
    });
    expect(fullDatasetSlice.totalGamesInDataset).toBe(8);
    expect(fullDatasetSlice.totalObservationsInDataset).toBe(80);
    expect(fullDatasetSlice.unpausedGamesInDatasetCount).toBe(7);
    expect(fullDatasetSlice.unpausedObservationsInDatasetCount).toBe(70);
    expect(fullDatasetSlice.pausedGamesInDatasetCount).toBe(1);
    expect(fullDatasetSlice.pausedObservationsInDatasetCount).toBe(10);
    for (const m of [5, 10, 15, 20] as const) {
      expect(fullDatasetSlice.checkpoints[m].availableSnapshotCount).toBe(80);
      expect(fullDatasetSlice.checkpoints[m].earlyTotalDeathsAvailableCount).toBe(70);
      expect(fullDatasetSlice.checkpoints[m].earlyTotalDeathsPausedGamesExcludedCount).toBe(10);
    }
    expect(fullDatasetSlice.optional14mSummary.availableSnapshotCount).toBe(80);
    expect(fullDatasetSlice.optional14mSummary.earlyTotalDeathsAvailableCount).toBe(70);
    expect(fullDatasetSlice.optional14mSummary.earlyTotalDeathsPausedGamesExcludedCount).toBe(10);
  });

  it('computes paired player vs pro Gold, Level, Role-Opponent GD/CSD, Early Total Deaths, Whole-Game KP/DMG%/WPM, and keeps soloKills/soloDeaths/turretPlates explicitly UNAVAILABLE', () => {
    const puuid = 'puuid-player-syndra-1';
    const oppPuuid = 'puuid-enemy-mid-cass';

    const complete5v5Match: MatchDto = {
      metadata: {
        matchId: 'EUW1_555001',
        participants: [
          'puuid-ally-top',
          'puuid-ally-jg',
          puuid,
          'puuid-ally-bot',
          'puuid-ally-sup',
          'puuid-enemy-top',
          'puuid-enemy-jg',
          oppPuuid,
          'puuid-enemy-bot',
          'puuid-enemy-sup',
        ],
      },
      info: {
        gameId: 555001,
        gameDuration: 1800,
        gameMode: 'CLASSIC',
        gameVersion: '16.20.826.3891',
        queueId: 420,
        participants: [
          {
            participantId: 1,
            puuid: 'puuid-ally-top',
            championName: 'KSante',
            teamPosition: 'TOP',
            teamId: 100,
            kills: 2,
            deaths: 3,
            assists: 7,
            totalDamageDealtToChampions: 20_000,
          },
          {
            participantId: 2,
            puuid: 'puuid-ally-jg',
            championName: 'LeeSin',
            teamPosition: 'JUNGLE',
            teamId: 100,
            kills: 4,
            deaths: 2,
            assists: 9,
            totalDamageDealtToChampions: 15_000,
          },
          {
            participantId: 3,
            puuid,
            championName: 'Syndra',
            teamPosition: 'MIDDLE',
            teamId: 100,
            win: true,
            kills: 8,
            deaths: 2,
            assists: 6,
            totalDamageDealtToChampions: 30_000,
            wardsPlaced: 15,
            wardsKilled: 6,
            totalMinionsKilled: 240,
            neutralMinionsKilled: 12,
            challenges: {
              soloKills: 2,
              turretPlatesTaken: 3,
            },
          },
          {
            participantId: 4,
            puuid: 'puuid-ally-bot',
            championName: 'Ezreal',
            teamPosition: 'BOTTOM',
            teamId: 100,
            kills: 5,
            deaths: 2,
            assists: 6,
            totalDamageDealtToChampions: 25_000,
          },
          {
            participantId: 5,
            puuid: 'puuid-ally-sup',
            championName: 'Nautilus',
            teamPosition: 'UTILITY',
            teamId: 100,
            kills: 1,
            deaths: 4,
            assists: 12,
            totalDamageDealtToChampions: 10_000,
          },
          {
            participantId: 8,
            puuid: oppPuuid,
            championName: 'Cassiopeia',
            teamPosition: 'MIDDLE',
            teamId: 200,
            win: false,
            kills: 3,
            deaths: 4,
            assists: 4,
            totalMinionsKilled: 220,
            neutralMinionsKilled: 8,
          },
        ],
      },
    };

    const timelineDto: MatchTimelineDto = {
      metadata: {
        matchId: 'EUW1_555001',
        participants: [puuid, oppPuuid],
      },
      info: {
        frameInterval: 60_000,
        participants: [
          { participantId: 3, puuid, championName: 'Syndra' },
          { participantId: 8, puuid: oppPuuid, championName: 'Cassiopeia' },
        ],
        frames: [
          {
            timestamp: 5 * 60_000,
            participantFrames: {
              '3': {
                participantId: 3,
                totalGold: 1850,
                level: 5,
                xp: 2100,
                currentGold: 400,
                minionsKilled: 40,
                jungleMinionsKilled: 0,
                position: { x: 7000, y: 7000 },
              },
              '8': {
                participantId: 8,
                totalGold: 1700,
                level: 5,
                xp: 1950,
                currentGold: 300,
                minionsKilled: 36,
                jungleMinionsKilled: 0,
                position: { x: 7200, y: 7200 },
              },
            },
            events: [
              {
                type: 'CHAMPION_KILL',
                timestamp: 4 * 60_000 + 10_000,
                killerId: 8,
                victimId: 3,
                assistingParticipantIds: null as unknown as number[],
              },
            ],
          },
          {
            timestamp: 10 * 60_000,
            participantFrames: {
              '3': {
                participantId: 3,
                totalGold: 3800,
                level: 9,
                xp: 5200,
                currentGold: 600,
                minionsKilled: 92,
                jungleMinionsKilled: 2,
                position: { x: 7000, y: 7000 },
              },
              '8': {
                participantId: 8,
                totalGold: 3500,
                level: 8,
                xp: 4700,
                currentGold: 400,
                minionsKilled: 86,
                jungleMinionsKilled: 0,
                position: { x: 7200, y: 7200 },
              },
            },
            events: [
              {
                type: 'CHAMPION_KILL',
                timestamp: 8 * 60_000 + 20_000,
                killerId: 3,
                victimId: 8,
                assistingParticipantIds: [],
              },
            ],
          },
          {
            timestamp: 15 * 60_000,
            participantFrames: {
              '3': {
                participantId: 3,
                totalGold: 5900,
                level: 11,
                xp: 8100,
                currentGold: 700,
                minionsKilled: 146,
                jungleMinionsKilled: 4,
                position: { x: 7000, y: 7000 },
              },
              '8': {
                participantId: 8,
                totalGold: 5400,
                level: 11,
                xp: 7800,
                currentGold: 500,
                minionsKilled: 138,
                jungleMinionsKilled: 2,
                position: { x: 7200, y: 7200 },
              },
            },
            events: [
              {
                type: 'CHAMPION_KILL',
                timestamp: 12 * 60_000 + 30_000,
                killerId: 8,
                victimId: 3,
                assistingParticipantIds: [7],
              },
            ],
          },
        ],
      },
    };

    const view = buildSearchedPlayerProComparison({
      identity: {
        puuid,
        region: 'EUW1',
        gameName: 'MidTester',
        tagLine: 'EUW',
      },
      visibleMatches: [complete5v5Match],
      timelinesByMatchId: { EUW1_555001: timelineDto },
    });

    const cp10 = view.checkpoints.find((c) => c.minute === 10)!;
    expect(cp10.playerMeanTotalCs).toBe(94.0);
    expect(cp10.proMeanTotalCs).toBe(96.0);
    expect(cp10.deltaTotalCs).toBe(-2.0);

    expect(cp10.playerMeanTotalGold).toBe(3800);
    expect(cp10.proMeanTotalGold).toBe(3660.7);
    expect(cp10.deltaTotalGold).toBe(139.3);

    expect(cp10.playerMeanLevel).toBe(9.0);
    expect(cp10.proMeanLevel).toBe(8.3);
    expect(cp10.deltaLevel).toBe(0.7);

    expect(cp10.playerMeanCsDiffVsRoleOpponent).toBe(8.0);
    expect(cp10.proMeanCsDiffVsRoleOpponent).toBe(-0.3);
    expect(cp10.deltaCsDiffVsRoleOpponent).toBe(8.3);

    expect(cp10.playerMeanGoldDiffVsRoleOpponent).toBe(300.0);
    expect(cp10.proMeanGoldDiffVsRoleOpponent).toBe(-189.7);
    expect(cp10.deltaGoldDiffVsRoleOpponent).toBe(489.7);

    expect(cp10.playerMeanEarlyTotalDeaths).toBe(1);
    expect(cp10.proEarlyTotalDeathsStatus).toBe('available');
    expect(cp10.proEarlyTotalDeathsPausedGamesExcluded).toBe(1);
    expect(cp10.proEarlyDeathsGamesReached).toBe(2);
    expect(cp10.proMeanEarlyTotalDeaths).toBe(0);
    expect(cp10.deltaEarlyTotalDeaths).toBe(1);

    const cp15 = view.checkpoints.find((c) => c.minute === 15)!;
    expect(cp15.playerMeanEarlyTotalDeaths).toBe(2);

    expect(view.wholeGameComparison.killParticipation.playerMean).toBe(0.7);
    expect(view.wholeGameComparison.killParticipation.proMean).toBe(0.5729);
    expect(view.wholeGameComparison.killParticipation.deltaMean).toBe(0.1271);

    expect(view.wholeGameComparison.championDamageShare.playerMean).toBe(0.3);
    expect(view.wholeGameComparison.championDamageShare.proMean).toBe(0.2212);
    expect(view.wholeGameComparison.championDamageShare.deltaMean).toBe(0.0788);

    expect(view.wholeGameComparison.wardsPlacedPerMin.playerMean).toBe(0.5);
    expect(view.wholeGameComparison.wardsPlacedPerMin.proMean).toBe(0.54);
    expect(view.wholeGameComparison.wardsPlacedPerMin.deltaMean).toBe(-0.04);

    expect(view.wholeGameComparison.wardsDestroyedPerMin.playerMean).toBe(0.2);
    expect(view.wholeGameComparison.wardsDestroyedPerMin.proMean).toBe(0.23);
    expect(view.wholeGameComparison.wardsDestroyedPerMin.deltaMean).toBe(-0.03);

    expect(view.unavailableRequestedMetrics.soloKills.status).toBe('UNAVAILABLE');
    expect(view.unavailableRequestedMetrics.soloKills.playerValue).toBeNull();
    expect(view.unavailableRequestedMetrics.soloKills.proValue).toBeNull();
    expect(view.unavailableRequestedMetrics.soloKills.deltaValue).toBeNull();

    expect(view.unavailableRequestedMetrics.soloDeaths.status).toBe('UNAVAILABLE');
    expect(view.unavailableRequestedMetrics.soloDeaths.playerValue).toBeNull();
    expect(view.unavailableRequestedMetrics.soloDeaths.proValue).toBeNull();
    expect(view.unavailableRequestedMetrics.soloDeaths.deltaValue).toBeNull();
    expect(view.unavailableRequestedMetrics.soloDeaths.explanation).toContain(
      'TimelineAnalysisService.kt'
    );

    expect(view.unavailableRequestedMetrics.turretPlates.status).toBe('UNAVAILABLE');
    expect(view.unavailableRequestedMetrics.turretPlates.playerValue).toBeNull();
    expect(view.unavailableRequestedMetrics.turretPlates.proValue).toBeNull();
    expect(view.unavailableRequestedMetrics.turretPlates.deltaValue).toBeNull();
    expect(view.unavailableRequestedMetrics.turretPlates.explanation).toContain('Patch 26.1');
  });

  it('rejects partial team participant arrays for KP/Damage Share and ambiguous role opponents or missing event arrays without zero-filling', () => {
    const profile = RECORDED_REVIEW_PROFILES.euw_top_specialist;
    const summary = extractPlayerMatchSummary(
      profile.visibleMatches[0],
      profile.puuid,
      profile.timelinesByMatchId
    )!;

    expect(summary.wholeGame.killParticipationStatus).toBe('incomplete_team_participants');
    expect(summary.wholeGame.killParticipation).toBeNull();
    expect(summary.wholeGame.championDamageShareStatus).toBe('incomplete_team_participants');
    expect(summary.wholeGame.championDamageShare).toBeNull();
    expect(summary.wholeGame.wardsPlacedPerMinStatus).toBe('missing_counter');
    expect(summary.wholeGame.wardsPlacedPerMin).toBeNull();

    const baseTimelineInfo = profile.timelinesByMatchId.EUW1_7201001.info!;
    const matchWithNullEventsTimeline = extractPlayerMatchSummary(
      profile.visibleMatches[0],
      profile.puuid,
      {
        EUW1_7201001: {
          ...profile.timelinesByMatchId.EUW1_7201001,
          info: {
            ...baseTimelineInfo,
            frames: baseTimelineInfo.frames.map((f) => ({
              ...f,
              events: undefined as unknown as [],
            })),
          },
        },
      }
    )!;
    expect(matchWithNullEventsTimeline.checkpoints[10].earlyDeathsStatus).toBe(
      'missing_events_array'
    );
    expect(matchWithNullEventsTimeline.checkpoints[10].earlyTotalDeaths).toBeNull();
  });

  it('sorts 25 shuffled + duplicate matches by validated timestamp newest-first before applying the 20-match cap, handles unknown dates deterministically, and strictly scopes pairOptions to the preselected or selected role', () => {
    const puuid = 'puuid-recent20-tester';
    const baseTimestampMs = 1_762_000_000_000;

    // Build 25 unique matches where:
    // - Chronological rank 1..15 (NEWEST, highest timestamps): Mid Syndra
    // - Chronological rank 16..20 (NEXT 5 newest timestamps): Top KSante
    // - Chronological rank 21..23 (OLDER timestamps beyond recent 20): Bot Ezreal
    // - Chronological rank 24..25 (UNKNOWN/missing or invalid timestamps <= 0): Bot Ezreal
    const chronologicalNewestFirst: MatchDto[] = Array.from({ length: 25 }, (_, idx) => {
      const rank = idx + 1; // 1 = newest, 25 = oldest/unknown
      const isMid = rank <= 15;
      const isTop = rank >= 16 && rank <= 20;
      const championName = isMid ? 'Syndra' : isTop ? 'KSante' : 'Ezreal';
      const teamPosition = isMid ? 'MIDDLE' : isTop ? 'TOP' : 'BOTTOM';
      const tsMs = baseTimestampMs + (30 - rank) * 3_600_000;

      // Test different timestamp fields and unknown-date cases:
      // - rank 1..18 use gameEndTimestamp
      // - rank 19..23 use gameCreation
      // - rank 24 has undefined timestamps (unknown date)
      // - rank 25 has gameEndTimestamp: 0 and gameCreation: -500 (invalid -> unknown date)
      const timestampFields =
        rank <= 18
          ? { gameEndTimestamp: tsMs }
          : rank <= 23
            ? { gameCreation: tsMs }
            : rank === 24
              ? {}
              : { gameEndTimestamp: 0, gameCreation: -500 };

      return {
        metadata: {
          matchId: `EUW1_REC_${String(rank).padStart(3, '0')}`,
          participants: [puuid],
        },
        info: {
          gameId: 8000 + rank,
          ...timestampFields,
          gameDuration: 1800,
          gameMode: 'CLASSIC',
          gameVersion: '16.20.1',
          queueId: 420,
          participants: [
            {
              participantId: 1,
              puuid,
              championName,
              teamPosition,
              win: rank % 2 === 0,
              kills: 5,
              deaths: 2,
              assists: 7,
              totalMinionsKilled: 210,
              neutralMinionsKilled: 10,
            },
          ],
        },
      };
    });

    // Verify resolveValidatedMatchSortTimestampMs directly
    expect(resolveValidatedMatchSortTimestampMs(chronologicalNewestFirst[0])).toBe(
      baseTimestampMs + 29 * 3_600_000
    );
    expect(resolveValidatedMatchSortTimestampMs(chronologicalNewestFirst[19])).toBe(
      baseTimestampMs + 10 * 3_600_000
    );
    expect(resolveValidatedMatchSortTimestampMs(chronologicalNewestFirst[23])).toBeNull();
    expect(resolveValidatedMatchSortTimestampMs(chronologicalNewestFirst[24])).toBeNull();

    // Pass the 25 matches in SHUFFLED + OLDEST-FIRST order (putting the 5 Bot Ezreal matches first in the input array!)
    // plus 2 duplicate match entries (including a duplicate of rank 1 that initially lacked a timestamp and is upgraded by the real rank 1 entry).
    const rank1WithoutTimestamp: MatchDto = {
      ...chronologicalNewestFirst[0],
      info: {
        ...chronologicalNewestFirst[0].info!,
        gameEndTimestamp: undefined,
        gameCreation: undefined,
      },
    };
    const shuffledAndDuplicatedInput: MatchDto[] = [
      chronologicalNewestFirst[24], // rank 25 (Ezreal Bot, invalid timestamp -> unknown)
      chronologicalNewestFirst[23], // rank 24 (Ezreal Bot, missing timestamp -> unknown)
      chronologicalNewestFirst[22], // rank 23 (Ezreal Bot, old timestamp)
      chronologicalNewestFirst[21], // rank 22 (Ezreal Bot, old timestamp)
      chronologicalNewestFirst[20], // rank 21 (Ezreal Bot, old timestamp)
      rank1WithoutTimestamp, // earlier duplicate of rank 1 without timestamp
      chronologicalNewestFirst[17], // rank 18 (KSante Top)
      chronologicalNewestFirst[10], // rank 11 (Syndra Mid)
      chronologicalNewestFirst[19], // rank 20 (KSante Top)
      chronologicalNewestFirst[19], // duplicate of rank 20
      chronologicalNewestFirst[3], // rank 4 (Syndra Mid)
      chronologicalNewestFirst[15], // rank 16 (KSante Top)
      chronologicalNewestFirst[0], // rank 1 (Syndra Mid, upgrades timestamp on duplicate)
      chronologicalNewestFirst[18], // rank 19 (KSante Top)
      chronologicalNewestFirst[16], // rank 17 (KSante Top)
      chronologicalNewestFirst[14], // rank 15 (Syndra Mid)
      chronologicalNewestFirst[1], // rank 2 (Syndra Mid)
      chronologicalNewestFirst[13], // rank 14 (Syndra Mid)
      chronologicalNewestFirst[2], // rank 3 (Syndra Mid)
      chronologicalNewestFirst[12], // rank 13 (Syndra Mid)
      chronologicalNewestFirst[4], // rank 5 (Syndra Mid)
      chronologicalNewestFirst[11], // rank 12 (Syndra Mid)
      chronologicalNewestFirst[5], // rank 6 (Syndra Mid)
      chronologicalNewestFirst[9], // rank 10 (Syndra Mid)
      chronologicalNewestFirst[6], // rank 7 (Syndra Mid)
      chronologicalNewestFirst[8], // rank 9 (Syndra Mid)
      chronologicalNewestFirst[7], // rank 8 (Syndra Mid)
    ];

    const defaultView = buildSearchedPlayerProComparison({
      identity: { puuid, region: 'EUW1', gameName: 'WindowTester', tagLine: 'EUW' },
      visibleMatches: shuffledAndDuplicatedInput,
      timelinesByMatchId: {},
    });

    expect(MAX_RECENT_PLAYER_MATCHES).toBe(20);
    expect(defaultView.recentMatchWindow).toEqual({
      maxRecentMatches: 20,
      timestampSortPolicy: 'known_timestamps_newest_first_then_unknown_in_input_order',
      inputMatchCount: 25,
      duplicateMatchesExcludedCount: 2,
      knownTimestampMatchCountInInput: 23,
      unknownTimestampMatchCountInInput: 2,
      analyzedRecentMatchCount: 20,
      knownTimestampMatchCountInRecent20: 20,
      unknownTimestampMatchCountInRecent20: 0,
      newestMatchTimestampMsInRecent20: baseTimestampMs + 29 * 3_600_000,
      oldestMatchTimestampMsInRecent20: baseTimestampMs + 10 * 3_600_000,
      excludedBeyondRecent20Count: 5,
      positionalMatchCountInRecent20: 20,
      excludedNonPositionalMatchesInRecent20: 0,
    });

    // Even though the 5 Ezreal Bot matches were placed FIRST in shuffledAndDuplicatedInput,
    // timestamp sorting newest-first before the 20-match cap excludes all 5 of them!
    expect(
      defaultView.allPairOptionsInRecent20.map((p) => `${p.role}::${p.championId}`)
    ).toEqual(['mid::Syndra', 'top::KSante']);
    expect(defaultView.roleSelection.detectedPrimaryRole).toBe('mid');
    expect(defaultView.roleSelection.selectedRole).toBe('mid');
    expect(defaultView.roleSelection.isRolePreselectedByDefault).toBe(true);
    expect(defaultView.roleSelection.playerGamesInSelectedRole).toBe(15);

    // Crucial: default role preselection strictly scopes pairOptions to the preselected primary role ('mid::Syndra'),
    // while allPairOptionsInRecent20 retains the separate cross-role list!
    expect(defaultView.pairOptions.map((p) => p.pairKey)).toEqual(['mid::Syndra']);
    expect(defaultView.selectedPair?.pairKey).toBe('mid::Syndra');
    // Verify activeMatches are sorted newest-first (EUW1_REC_001 .. EUW1_REC_015)
    expect(defaultView.activeMatches.map((m) => m.matchId)).toEqual(
      Array.from({ length: 15 }, (_, idx) => `EUW1_REC_${String(idx + 1).padStart(3, '0')}`)
    );

    // Explicitly passing selectedRole: 'ALL' returns all roles in pairOptions
    const allRolesView = buildSearchedPlayerProComparison({
      identity: { puuid, region: 'EUW1', gameName: 'WindowTester', tagLine: 'EUW' },
      visibleMatches: shuffledAndDuplicatedInput,
      timelinesByMatchId: {},
      selectedRole: 'ALL',
    });
    expect(allRolesView.roleSelection.selectedRole).toBe('ALL');
    expect(allRolesView.roleSelection.isRolePreselectedByDefault).toBe(false);
    expect(allRolesView.pairOptions.map((p) => p.pairKey)).toEqual([
      'mid::Syndra',
      'top::KSante',
    ]);

    // Switch role to 'top' -> changeable role filter narrows pairOptions to Top · KSante (5G in recent 20)
    const topRoleView = buildSearchedPlayerProComparison({
      identity: { puuid, region: 'EUW1', gameName: 'WindowTester', tagLine: 'EUW' },
      visibleMatches: shuffledAndDuplicatedInput,
      timelinesByMatchId: {},
      selectedRole: 'top',
    });
    expect(topRoleView.roleSelection.detectedPrimaryRole).toBe('mid');
    expect(topRoleView.roleSelection.selectedRole).toBe('top');
    expect(topRoleView.roleSelection.isRolePreselectedByDefault).toBe(false);
    expect(topRoleView.roleSelection.playerGamesInSelectedRole).toBe(5);
    expect(topRoleView.pairOptions.map((p) => p.pairKey)).toEqual(['top::KSante']);
    expect(topRoleView.selectedPair?.pairKey).toBe('top::KSante');

    // Switch role to 'bottom' (where the 5 Ezreal games were older/unknown beyond the newest 20) -> 0 games in recent 20
    const bottomRoleView = buildSearchedPlayerProComparison({
      identity: { puuid, region: 'EUW1', gameName: 'WindowTester', tagLine: 'EUW' },
      visibleMatches: shuffledAndDuplicatedInput,
      timelinesByMatchId: {},
      selectedRole: 'bottom',
    });
    expect(bottomRoleView.roleSelection.selectedRole).toBe('bottom');
    expect(bottomRoleView.roleSelection.playerGamesInSelectedRole).toBe(0);
    expect(bottomRoleView.pairOptions).toHaveLength(0);
    expect(bottomRoleView.selectedPair).toBeNull();
  });

  it('exposes actual selectable pro players with stable esportsPlayerIds and comparable game counts, and returns unavailable for Chovy/Faker or 0-game pro slices', () => {
    // 1. All 25 unique pros in the 8-game dataset are listed with stable IDs
    const allPros = listSelectableProPlayers(DEFAULT_PRO_BENCHMARK_DATASET);
    expect(allPros).toHaveLength(25);

    // Mid role has 5 actual pros: HLE Zeka (4G), IG Rookie (4G), TES Creme (4G), BLG Knight (2G), G2 Caps (2G)
    const midPros = listSelectableProPlayers(DEFAULT_PRO_BENCHMARK_DATASET, { role: 'mid' });
    expect(midPros.map((p) => `${p.summonerName} (${p.esportsPlayerId})`)).toEqual([
      'HLE Zeka (103478281361900912)',
      'IG Rookie (99566404811346612)',
      'TES Creme (106368556422916908)',
      'BLG Knight (99566404803543690)',
      'G2 Caps (98767975968177297)',
    ]);

    // Mid · Syndra slice has 2 pros with >0 games: HLE Zeka (2G) and IG Rookie (1G)
    const syndraPros = listSelectableProPlayers(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'mid',
      championId: 'Syndra',
      onlyWithMatchingGames: true,
    });
    expect(
      syndraPros.map((p) => ({
        name: p.playerHandle,
        id: p.esportsPlayerId,
        games: p.matchingGamesAfterRoleAndChampionFilter,
      }))
    ).toEqual([
      { name: 'Zeka', id: '103478281361900912', games: 2 },
      { name: 'Rookie', id: '99566404811346612', games: 1 },
    ]);

    // Vision examples Chovy and Faker are NOT in the 8-game dataset -> resolveSelectableProPlayer returns null
    expect(resolveSelectableProPlayer(DEFAULT_PRO_BENCHMARK_DATASET, 'Chovy')).toBeNull();
    expect(resolveSelectableProPlayer(DEFAULT_PRO_BENCHMARK_DATASET, 'Faker')).toBeNull();

    const krProfile = RECORDED_REVIEW_PROFILES.kr_mid_specialist;

    // Narrow Mid · Syndra to HLE Zeka by stable esportsPlayerId -> 2 unpaused games (10m CS: (96+100)/2 = 98.0)
    const zekaView = buildSearchedPlayerProComparison({
      identity: {
        puuid: krProfile.puuid,
        region: krProfile.region,
        gameName: krProfile.gameName,
        tagLine: krProfile.tagLine,
      },
      visibleMatches: krProfile.visibleMatches,
      timelinesByMatchId: krProfile.timelinesByMatchId,
      selectedPairKey: 'mid::Syndra',
      selectedProPlayerId: '103478281361900912',
    });
    expect(zekaView.proPlayerSelection.selectedProPlayerId).toBe('103478281361900912');
    expect(zekaView.proPlayerSelection.isProPlayerFoundInDataset).toBe(true);
    expect(zekaView.proPlayerSelection.resolvedProPlayer?.playerHandle).toBe('Zeka');
    expect(zekaView.proPlayerSelection.matchingProGamesAfterFilters).toBe(2);
    expect(zekaView.proPlayerSelection.proReferenceAvailableAfterFilters).toBe(true);
    expect(zekaView.checkpoints.find((c) => c.minute === 10)?.proMeanTotalCs).toBe(98.0);
    expect(zekaView.checkpoints.find((c) => c.minute === 10)?.proGamesReached).toBe(2);

    // Narrow Mid · Syndra to IG Rookie ('99566404811346612') -> 1 game (paused IG vs TES G1: aligned CS available, early deaths paused-excluded)
    const rookieView = buildSearchedPlayerProComparison({
      identity: {
        puuid: krProfile.puuid,
        region: krProfile.region,
        gameName: krProfile.gameName,
        tagLine: krProfile.tagLine,
      },
      visibleMatches: krProfile.visibleMatches,
      timelinesByMatchId: krProfile.timelinesByMatchId,
      selectedPairKey: 'mid::Syndra',
      selectedProPlayerId: 'Rookie',
    });
    expect(rookieView.proPlayerSelection.resolvedProPlayer?.esportsPlayerId).toBe(
      '99566404811346612'
    );
    expect(rookieView.proPlayerSelection.matchingProGamesAfterFilters).toBe(1);
    expect(rookieView.proPlayerSelection.proReferenceAvailableAfterFilters).toBe(true);
    const rookieCp10 = rookieView.checkpoints.find((c) => c.minute === 10)!;
    expect(rookieCp10.proMeanTotalCs).toBe(92.0);
    expect(rookieCp10.proEarlyTotalDeathsStatus).toBe('all_reached_games_paused');
    expect(rookieCp10.proMeanEarlyTotalDeaths).toBeNull();

    // Narrow Mid · Syndra to G2 Caps ('98767975968177297') -> in dataset (2G mid on Cassiopeia/Galio) but 0G on Syndra -> unavailable
    const capsOnSyndraView = buildSearchedPlayerProComparison({
      identity: {
        puuid: krProfile.puuid,
        region: krProfile.region,
        gameName: krProfile.gameName,
        tagLine: krProfile.tagLine,
      },
      visibleMatches: krProfile.visibleMatches,
      timelinesByMatchId: krProfile.timelinesByMatchId,
      selectedPairKey: 'mid::Syndra',
      selectedProPlayerId: '98767975968177297',
    });
    expect(capsOnSyndraView.proPlayerSelection.isProPlayerFoundInDataset).toBe(true);
    expect(capsOnSyndraView.proPlayerSelection.resolvedProPlayer?.playerHandle).toBe('Caps');
    expect(capsOnSyndraView.proPlayerSelection.matchingProGamesAfterFilters).toBe(0);
    expect(capsOnSyndraView.proPlayerSelection.proReferenceAvailableAfterFilters).toBe(false);
    expect(capsOnSyndraView.checkpoints.find((c) => c.minute === 10)?.proMeanTotalCs).toBeNull();

    // Narrow to vision example 'Chovy' or 'Faker' -> NOT in dataset, never fabricated -> unavailable
    for (const missingProName of ['Chovy', 'Faker']) {
      const missingProView = buildSearchedPlayerProComparison({
        identity: {
          puuid: krProfile.puuid,
          region: krProfile.region,
          gameName: krProfile.gameName,
          tagLine: krProfile.tagLine,
        },
        visibleMatches: krProfile.visibleMatches,
        timelinesByMatchId: krProfile.timelinesByMatchId,
        selectedPairKey: 'mid::Syndra',
        selectedProPlayerId: missingProName,
      });
      expect(missingProView.proPlayerSelection.selectedProPlayerId).toBe(missingProName);
      expect(missingProView.proPlayerSelection.isProPlayerFoundInDataset).toBe(false);
      expect(missingProView.proPlayerSelection.resolvedProPlayer).toBeNull();
      expect(missingProView.proPlayerSelection.matchingProGamesAfterFilters).toBe(0);
      expect(missingProView.proPlayerSelection.proReferenceAvailableAfterFilters).toBe(false);
      expect(missingProView.checkpoints.find((c) => c.minute === 10)?.proStatus).toBe(
        'unsupported_pair'
      );
      expect(missingProView.checkpoints.find((c) => c.minute === 10)?.proMeanTotalCs).toBeNull();
      expect(missingProView.checkpoints.find((c) => c.minute === 10)?.deltaTotalCs).toBeNull();
    }
  });

  it('audits solo-death frequency vs Match History displays: preserves unknown when assistingParticipantIds is missing, labels 0-assist deaths as not proven 1v1, and never conflates opponent soloKills with player soloDeaths', () => {
    const puuid = 'puuid-death-audit';
    const oppPuuid = 'puuid-opp-mid';

    const makeMatch = (matchId: string, oppSoloKills?: number): MatchDto => ({
      metadata: { matchId, participants: [puuid, oppPuuid] },
      info: {
        gameId: Number(matchId.replace(/\D/g, '')),
        gameDuration: 1800,
        gameMode: 'CLASSIC',
        gameVersion: '16.20.1',
        queueId: 420,
        participants: [
          {
            participantId: 3,
            puuid,
            championName: 'Syndra',
            teamPosition: 'MIDDLE',
            teamId: 100,
            kills: 4,
            deaths: 2,
            assists: 5,
            totalMinionsKilled: 200,
            neutralMinionsKilled: 10,
          },
          {
            participantId: 8,
            puuid: oppPuuid,
            championName: 'Cassiopeia',
            teamPosition: 'MIDDLE',
            teamId: 200,
            kills: 5,
            deaths: 3,
            assists: 4,
            totalMinionsKilled: 195,
            neutralMinionsKilled: 8,
            ...(oppSoloKills !== undefined ? { challenges: { soloKills: oppSoloKills } } : {}),
          },
        ],
      },
    });

    // Match 1: complete assist arrays -> 1 zero-assist death (`[]`) and 1 assisted death (`[7]`)
    const timelineComplete: MatchTimelineDto = {
      metadata: { matchId: 'EUW1_9901', participants: [puuid, oppPuuid] },
      info: {
        frameInterval: 60_000,
        participants: [
          { participantId: 3, puuid },
          { participantId: 8, puuid: oppPuuid },
        ],
        frames: [
          {
            timestamp: 600_000,
            participantFrames: {},
            events: [
              {
                type: 'CHAMPION_KILL',
                timestamp: 300_000,
                killerId: 8,
                victimId: 3,
                assistingParticipantIds: [],
              },
              {
                type: 'CHAMPION_KILL',
                timestamp: 540_000,
                killerId: 8,
                victimId: 3,
                assistingParticipantIds: [7],
              },
            ],
          },
        ],
      },
    };

    // Match 2: one death has `assistingParticipantIds: undefined` -> MUST be treated as `incomplete_missing_assist_array` (unknown, NOT 0 or solo)
    const timelineMissingAssists: MatchTimelineDto = {
      metadata: { matchId: 'EUW1_9902', participants: [puuid, oppPuuid] },
      info: {
        frameInterval: 60_000,
        participants: [
          { participantId: 3, puuid },
          { participantId: 8, puuid: oppPuuid },
        ],
        frames: [
          {
            timestamp: 600_000,
            participantFrames: {},
            events: [
              {
                type: 'CHAMPION_KILL',
                timestamp: 400_000,
                killerId: 8,
                victimId: 3,
                // Missing assistingParticipantIds!
              },
            ],
          },
        ],
      },
    };

    const view = buildSearchedPlayerProComparison({
      identity: { puuid, region: 'EUW1', gameName: 'DeathAudit', tagLine: 'EUW' },
      visibleMatches: [makeMatch('EUW1_9901', 3), makeMatch('EUW1_9902', undefined)],
      timelinesByMatchId: {
        EUW1_9901: timelineComplete,
        EUW1_9902: timelineMissingAssists,
      },
    });

    const m1 = view.activeMatches.find((m) => m.matchId === 'EUW1_9901')!;
    const m2 = view.activeMatches.find((m) => m.matchId === 'EUW1_9902')!;

    expect(m1.deathAttribution.timelineAssistStatus).toBe('available');
    expect(m1.deathAttribution.totalTimelineDeaths).toBe(2);
    expect(m1.deathAttribution.zeroAssistDeathsNotProvenSolo).toBe(1);
    expect(m1.deathAttribution.knownAssistedDeaths).toBe(1);
    expect(m1.deathAttribution.unknownAssistDeathsCount).toBe(0);
    expect(m1.deathAttribution.zeroAssistDeathShareNotProvenSolo).toBe(0.5);
    expect(
      m1.deathAttribution.opponentOwnSoloKillsChallengeNotPlayerSoloDeaths
    ).toBe(3);

    // Match 2 had a missing assist array -> status is incomplete_missing_assist_array and values are null (unknown), NEVER coerced to 0
    expect(m2.deathAttribution.timelineAssistStatus).toBe(
      'incomplete_missing_assist_array'
    );
    expect(m2.deathAttribution.totalTimelineDeaths).toBe(1);
    expect(m2.deathAttribution.unknownAssistDeathsCount).toBe(1);
    expect(m2.deathAttribution.zeroAssistDeathsNotProvenSolo).toBeNull();
    expect(m2.deathAttribution.knownAssistedDeaths).toBeNull();
    expect(m2.deathAttribution.zeroAssistDeathShareNotProvenSolo).toBeNull();
    expect(
      m2.deathAttribution.opponentOwnSoloKillsChallengeNotPlayerSoloDeaths
    ).toBeNull();

    // Slice aggregation only includes Match 1 (1 complete game) and reports Match 2 as excluded by missing assist arrays
    expect(
      view.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .eligibleCompleteTimelineGames
    ).toBe(1);
    expect(
      view.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .excludedIncompleteAssistGames
    ).toBe(1);
    expect(
      view.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .zeroAssistDeathsPerGameNotProvenSolo
    ).toBe(1.0);
    expect(
      view.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .zeroAssistDeathShareNotProvenSolo
    ).toBe(0.5);
    expect(
      view.playerDeathAttribution.zeroAssistDeathsNotProvenSolo.proReference
    ).toBeNull();
    expect(
      view.playerDeathAttribution.zeroAssistDeathsNotProvenSolo.deltaVsPro
    ).toBeNull();
    expect(
      view.playerDeathAttribution.matchHistoryDisplayAudit
        .playerStatsCardLine166And269
    ).toContain('PlayerStats.tsx');
    expect(
      view.playerDeathAttribution.matchHistoryDisplayAudit.matchDetailsTabLine138
    ).toContain('MatchDetailsTab.tsx');
    expect(view.unavailableRequestedMetrics.soloDeaths.playerValue).toBeNull();
  });

  it('computes exact own-team Kill Participation for G2 vs HLE G2 Red-side execution edge case and returns null on incomplete teams or negative/missing/zero denominators', () => {
    // Locate G2 vs HLE G2 where G2 BrokenBlade played Camille on Red side (participantIds 6..10, teamId '98767991926151025')
    const g2Game = DEFAULT_PRO_BENCHMARK_DATASET.games.find((g) =>
      Object.values(g.participants).some(
        (p) => p.summonerName === 'G2 BrokenBlade' && p.championId === 'Camille'
      )
    )!;
    expect(g2Game).toBeDefined();

    // HLE had 8 total deaths (1 execution), while G2's 5 players had 4 + 1 + 1 + 0 + 1 = 7 own-team kills.
    const hleDeaths = Object.values(g2Game.participants)
      .filter((p) => p.side === 'blue')
      .reduce((s, p) => s + p.finalDeaths, 0);
    const g2Kills = Object.values(g2Game.participants)
      .filter((p) => p.side === 'red')
      .reduce((s, p) => s + p.finalKills, 0);
    expect(hleDeaths).toBe(8);
    expect(g2Kills).toBe(7);

    // Verify all 5 G2 players use own-team kills (7) rather than opposing deaths (8)
    const byName = Object.fromEntries(
      Object.values(g2Game.participants)
        .filter((p) => p.side === 'red')
        .map((p) => [p.summonerName, p])
    );
    expect(byName['G2 BrokenBlade'].killParticipation).toBe(0.75);
    expect(computeExactProTeamKillParticipation(g2Game, byName['G2 BrokenBlade'])).toBe(0.8571);
    expect(computeExactProTeamKillParticipation(g2Game, byName['G2 SkewMond'])).toBe(0.4286);
    expect(computeExactProTeamKillParticipation(g2Game, byName['G2 Caps'])).toBe(0.2857);
    expect(computeExactProTeamKillParticipation(g2Game, byName['G2 Hans Sama'])).toBe(0.4286);
    expect(computeExactProTeamKillParticipation(g2Game, byName['G2 Labrov'])).toBe(0.7143);

    // Slice output exposes both corrected KP (0.8571) and rawFeedKillParticipation (0.75)
    const camilleSlice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'top',
      championId: 'Camille',
      proPlayerId: byName['G2 BrokenBlade'].esportsPlayerId,
    });
    expect(camilleSlice.wholeGameSummary.killParticipation.mean).toBe(0.8571);
    expect(camilleSlice.evidenceRows[0].killParticipation).toBe(0.8571);
    expect(camilleSlice.evidenceRows[0].rawFeedKillParticipation).toBe(0.75);

    // Strict guardrails on Pro KP: <5 same-side players, duplicate participantId, negative counter, NaN counter, and 0 team kills -> null
    const cloneGame = () => JSON.parse(JSON.stringify(g2Game)) as typeof g2Game;

    const missingTeammateGame = cloneGame();
    delete missingTeammateGame.participants['10'];
    expect(
      computeExactProTeamKillParticipation(
        missingTeammateGame,
        missingTeammateGame.participants['6']!
      )
    ).toBeNull();

    const duplicatePidGame = cloneGame();
    duplicatePidGame.participants['10']!.participantId = 6;
    expect(
      computeExactProTeamKillParticipation(duplicatePidGame, duplicatePidGame.participants['6']!)
    ).toBeNull();

    const negativeKillsGame = cloneGame();
    negativeKillsGame.participants['9']!.finalKills = -1;
    expect(
      computeExactProTeamKillParticipation(negativeKillsGame, negativeKillsGame.participants['6']!)
    ).toBeNull();

    const nanAssistsGame = cloneGame();
    nanAssistsGame.participants['8']!.finalAssists = Number.NaN;
    expect(
      computeExactProTeamKillParticipation(nanAssistsGame, nanAssistsGame.participants['6']!)
    ).toBeNull();

    const zeroTeamKillsGame = cloneGame();
    for (const k of ['6', '7', '8', '9', '10']) {
      zeroTeamKillsGame.participants[k]!.finalKills = 0;
    }
    expect(
      computeExactProTeamKillParticipation(zeroTeamKillsGame, zeroTeamKillsGame.participants['6']!)
    ).toBeNull();

    // Strict guardrails on Player whole-game metrics: duplicate teammate PUUID, negative/missing teammate counters, zero team kills/damage, and <=0 duration -> null
    const baseParticipants = [1, 2, 3, 4, 5].map((pid) => ({
      participantId: pid,
      puuid: `puuid-t-${pid}`,
      championName: 'KSante',
      teamPosition: 'TOP',
      teamId: 100,
      kills: 2,
      deaths: 1,
      assists: 3,
      totalDamageDealtToChampions: 10_000,
      totalMinionsKilled: 180,
      neutralMinionsKilled: 10,
      wardsPlaced: 12,
      wardsKilled: 4,
    }));

    const dupPuuidMatch: MatchDto = {
      metadata: { matchId: 'EUW1_GUARD_DUP', participants: [] },
      info: {
        gameId: 99001,
        gameDuration: 1800,
        participants: baseParticipants.map((p, idx) =>
          idx === 4 ? { ...p, puuid: 'puuid-t-1' } : p
        ),
      },
    };
    const dupMetrics = extractPlayerWholeGameMetrics(
      dupPuuidMatch,
      dupPuuidMatch.info!.participants![0],
      1800
    );
    expect(dupMetrics.killParticipationStatus).toBe('incomplete_team_participants');
    expect(dupMetrics.killParticipation).toBeNull();
    expect(dupMetrics.championDamageShare).toBeNull();

    const negTeammateMatch: MatchDto = {
      metadata: { matchId: 'EUW1_GUARD_NEG', participants: [] },
      info: {
        gameId: 99002,
        gameDuration: 1800,
        participants: baseParticipants.map((p, idx) =>
          idx === 3
            ? { ...p, assists: -1, totalDamageDealtToChampions: -50 }
            : p
        ),
      },
    };
    const negMetrics = extractPlayerWholeGameMetrics(
      negTeammateMatch,
      negTeammateMatch.info!.participants![0],
      1800
    );
    expect(negMetrics.killParticipationStatus).toBe('missing_counter');
    expect(negMetrics.killParticipation).toBeNull();
    expect(negMetrics.championDamageShareStatus).toBe('missing_counter');
    expect(negMetrics.championDamageShare).toBeNull();

    const zeroDenomAndZeroDurMatch: MatchDto = {
      metadata: { matchId: 'EUW1_GUARD_ZERO', participants: [] },
      info: {
        gameId: 99003,
        gameDuration: 0,
        participants: baseParticipants.map((p) => ({
          ...p,
          kills: 0,
          totalDamageDealtToChampions: 0,
        })),
      },
    };
    const zeroMetrics = extractPlayerWholeGameMetrics(
      zeroDenomAndZeroDurMatch,
      zeroDenomAndZeroDurMatch.info!.participants![0],
      0
    );
    expect(zeroMetrics.killParticipationStatus).toBe('zero_team_denominator');
    expect(zeroMetrics.killParticipation).toBeNull();
    expect(zeroMetrics.championDamageShareStatus).toBe('zero_team_denominator');
    expect(zeroMetrics.championDamageShare).toBeNull();
    expect(zeroMetrics.csPerMinStatus).toBe('missing_counter');
    expect(zeroMetrics.csPerMin).toBeNull();
    expect(zeroMetrics.wardsPlacedPerMinStatus).toBe('missing_counter');
    expect(zeroMetrics.wardsPlacedPerMin).toBeNull();
  });

  it('renders FullContract#EUW Role-First recent20 comparison, comparable Gold/Level/Deaths/KP/DMG%/CSm, optional Named Pro filter, short-game & pause exclusions, 30m unavailable, missing metrics as null, and finite-sample/synthetic caveats', () => {
    const fullProfile = RECORDED_REVIEW_PROFILES.euw_full_contract_sample;

    // 1. Adapter verification: 22 input matches -> recent20 analyzes newest 20, excludes 2 older; Role-First ('ROLE_ALL') selects Top (16G in recent20)
    const roleFirstView = buildSearchedPlayerProComparison({
      identity: {
        puuid: fullProfile.puuid,
        region: fullProfile.region,
        gameName: fullProfile.gameName,
        tagLine: fullProfile.tagLine,
      },
      visibleMatches: fullProfile.visibleMatches,
      timelinesByMatchId: fullProfile.timelinesByMatchId,
      selectedPairKey: 'ROLE_ALL',
    });

    expect(roleFirstView.comparisonScope).toBe('role_first');
    expect(roleFirstView.recentMatchWindow.inputMatchCount).toBe(22);
    expect(roleFirstView.recentMatchWindow.analyzedRecentMatchCount).toBe(20);
    expect(roleFirstView.recentMatchWindow.excludedBeyondRecent20Count).toBe(2);
    expect(roleFirstView.roleSelection.selectedRole).toBe('top');
    expect(roleFirstView.selectedPair?.pairKey).toBe('top::ALL');
    expect(roleFirstView.selectedPair?.playerGameCount).toBe(16);
    expect(roleFirstView.selectedPair?.proSampleGameCount).toBe(16);

    // Whole-game Gold/min is intentionally NOT claimed or exposed because MatchDto.goldEarned vs livestats finalGold is unverified at whole game
    expect('goldPerMin' in roleFirstView.wholeGameComparison).toBe(false);
    expect(roleFirstView.wholeGameComparison.killParticipation.playerMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.killParticipation.proMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.championDamageShare.playerMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.championDamageShare.proMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.totalDeaths.playerMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.totalDeaths.proMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.csPerMin.playerMean).not.toBeNull();
    expect(roleFirstView.wholeGameComparison.csPerMin.proMean).not.toBeNull();

    // Short game (EUW1_FULL_009 ended at 22:30) and unloaded timeline (EUW1_FULL_016) are tracked honestly at 25m & 30m, never zero-filled
    const cp25 = roleFirstView.checkpoints.find((c) => c.minute === 25)!;
    expect(cp25.playerTotalGames).toBe(16);
    expect(cp25.playerGamesWithTimeline).toBe(15);
    expect(cp25.playerShortGamesExcluded).toBe(1);
    expect(cp25.playerGamesReached).toBe(14);
    expect(cp25.proEarlyTotalDeathsStatus).toBe('not_in_sample_export');
    expect(cp25.proMeanEarlyTotalDeaths).toBeNull();

    const cp30 = roleFirstView.checkpoints.find((c) => c.minute === 30)!;
    expect(cp30.proStatus).toBe('not_in_sample_export');
    expect(cp30.proMeanTotalCs).toBeNull();
    expect(cp30.proMeanTotalGold).toBeNull();
    expect(cp30.proMeanLevel).toBeNull();
    expect(cp30.proMeanEarlyTotalDeaths).toBeNull();
    expect(cp30.deltaTotalCs).toBeNull();
    expect(cp30.deltaTotalGold).toBeNull();

    // 2. Render full private preview UI (defaults directly to Ironclad#EUW without query params)
    const { unmount } = render(<ProComparisonPreview initialSurface="profile" />);
    expect(screen.getByTestId('pro-comparison-datasource-badge')).toHaveTextContent(
      'Sample player · Not real account data (Offline)'
    );

    expect(screen.getByTestId('pro-comparison-identity-badge')).toHaveTextContent(
      'Ironclad#EUW (EUW1)'
    );
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent(
      'Top · All Top Champions'
    );
    expect(screen.getByTestId('recent20-window-strip')).toHaveTextContent(
      'Recent 20/20 Matches (2 older excluded)'
    );

    // Whole-game comparable cards render complete non-truncated titles/subtitles and accessible aria-labels
    const expectedWholeGameLabels: Array<{ key: string; title: string; subtitle: string }> = [
      {
        key: 'killParticipation',
        title: 'Kill Participation',
        subtitle: 'Kills + Assists / Team Kills',
      },
      {
        key: 'championDamageShare',
        title: 'Damage Share',
        subtitle: 'Champion Damage / Team Damage',
      },
      {
        key: 'totalDeaths',
        title: 'Full-Game Deaths',
        subtitle: 'Total Deaths per Game',
      },
      {
        key: 'csPerMin',
        title: 'Whole-Game CS / Min',
        subtitle: 'Lane + Jungle CS per Minute',
      },
    ];
    for (const item of expectedWholeGameLabels) {
      const cardEl = screen.getByTestId(`whole-game-card-${item.key}`);
      const titleEl = screen.getByTestId(`whole-game-title-${item.key}`);
      const subEl = screen.getByTestId(`whole-game-subtitle-${item.key}`);
      expect(cardEl).toHaveAttribute('aria-label', `${item.title} (${item.subtitle})`);
      expect(titleEl).toHaveTextContent(item.title);
      expect(subEl).toHaveTextContent(item.subtitle);
      expect(titleEl.className).not.toContain('truncate');
      expect(subEl.className).not.toContain('truncate');
    }
    expect(screen.getByTestId('profile-pro-comparison-tab')).toHaveTextContent(
      'Gold is compared at 5m–25m checkpoints only (end-of-game total gold rules are not verified identical)'
    );

    // Checkpoint cards render Gold, Level, and Early Unpaused Deaths alongside CS, and 30m renders Not available at 30m
    expect(screen.getByTestId('paired-gold-row-10m')).toHaveTextContent('Gold');
    expect(screen.getByTestId('paired-level-row-10m')).toHaveTextContent('Level');
    expect(screen.getByTestId('paired-deaths-row-10m')).toHaveTextContent('Deaths');
    expect(screen.getByTestId('player-denom-25m')).toHaveTextContent('14/16G');
    expect(screen.getByTestId('pro-unavailable-30m')).toHaveTextContent('Not available at 30m');

    // Optional Named Pro filter narrows Top baseline from 16G to HLE Zeus (4G)
    fireEvent.change(screen.getByTestId('player-pro-select'), {
      target: { value: '105320680474347057' },
    });
    expect(screen.getByTestId('pro-reference-context-badge')).toHaveTextContent(
      'Pro 4G Finite 8-Game Sample (HLE Zeus · Patch 16.20)'
    );

    // Switch Role to Mid -> Mid · Syndra -> IG Rookie (1G paused IG vs TES G1) -> Early Deaths shows Paused game excluded
    fireEvent.change(screen.getByTestId('player-role-select'), {
      target: { value: 'mid' },
    });
    fireEvent.change(screen.getByTestId('player-pair-select'), {
      target: { value: 'mid::Syndra' },
    });
    fireEvent.change(screen.getByTestId('player-pro-select'), {
      target: { value: '99566404811346612' },
    });
    expect(screen.getByTestId('pro-early-deaths-unavailable-10m')).toHaveTextContent(
      'Paused game excluded'
    );

    // Excluded / Unavailable metrics strip shows plain League "Not available" (never 0, never null) for soloKills, turretPlates, soloDeaths
    expect(screen.getByTestId('excluded-metric-soloKills')).toHaveTextContent('Not available');
    expect(screen.getByTestId('excluded-metric-turretPlates')).toHaveTextContent('Not available');
    expect(screen.getByTestId('excluded-metric-soloDeaths')).toHaveTextContent('Not available');

    // Caveats explicitly state finite 8-game sample (not broad proof), not solo-queue percentile, and public esports permission/terms
    const caveats = screen.getByTestId('profile-comparison-caveat');
    expect(caveats).toHaveTextContent('Finite 8-game Worlds 2026 sample');
    expect(caveats).toHaveTextContent('not broad proof');
    expect(caveats).toHaveTextContent('not a solo-queue percentile');
    expect(caveats).toHaveTextContent('permission/terms remain unresolved');

    unmount();

    // Verify local_json badge distinction on ProfileProComparisonTab
    render(
      <ProfileProComparisonTab
        puuid={fullProfile.puuid}
        region={fullProfile.region}
        gameName={fullProfile.gameName}
        tagLine={fullProfile.tagLine}
        visibleMatches={fullProfile.visibleMatches}
        initialTimelinesByMatchId={fullProfile.timelinesByMatchId}
        dataSourceMode="local_json"
      />
    );
    expect(screen.getByTestId('tab-datasource-pill')).toHaveTextContent(
      'Sample player · Loaded match data (Offline)'
    );
  });

  it('strictly blocks timelineApi / apiClient / fetch calls in synthetic_test_profile and local_json modes (including unloaded sample games) while keeping live_profile API loading intact', async () => {
    const getMatchTimelineSpy = vi
      .spyOn(timelineApi, 'getMatchTimeline')
      .mockImplementation(async () => {
        throw new Error('Unexpected timelineApi.getMatchTimeline network call in private mode');
      });
    const apiClientGetSpy = vi.spyOn(apiClient, 'get').mockImplementation(async () => {
      throw new Error('Unexpected apiClient.get network call in private mode');
    });
    const globalFetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Unexpected global fetch call in private mode');
    });

    try {
      // 1. ProComparisonPreview default Ironclad#EUW (synthetic_test_profile) has EUW1_FULL_016 intentionally unloaded (15/16G)
      const previewRender = render(<ProComparisonPreview initialSurface="profile" />);

      const defaultBtn = screen.getByTestId('load-pair-timelines-btn') as HTMLButtonElement;
      expect(defaultBtn).toBeDisabled();
      expect(defaultBtn).toHaveTextContent('15/16G timelines · Missing match timeline (1G · Offline)');

      // Attempt both normal click and forced-enabled click to verify handler guard
      fireEvent.click(defaultBtn);
      defaultBtn.disabled = false;
      fireEvent.click(defaultBtn);
      defaultBtn.disabled = true;

      // Select Top · Garen and specifically the unloaded match EUW1_FULL_016
      fireEvent.change(screen.getByTestId('player-pair-select'), {
        target: { value: 'top::Garen' },
      });
      fireEvent.change(screen.getByTestId('player-match-scope-select'), {
        target: { value: 'EUW1_FULL_016' },
      });

      const unloadedMatchBtn = screen.getByTestId('load-pair-timelines-btn') as HTMLButtonElement;
      expect(unloadedMatchBtn).toBeDisabled();
      expect(unloadedMatchBtn).toHaveTextContent(
        '1/2G timelines · Missing match timeline (1G · Offline)'
      );
      expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent(
        'Missing match timeline (Offline)'
      );

      fireEvent.click(unloadedMatchBtn);
      unloadedMatchBtn.disabled = false;
      fireEvent.click(unloadedMatchBtn);
      unloadedMatchBtn.disabled = true;

      // 2. Switch to Developer JSON Loader inside ProComparisonPreview with 0 loaded timelines
      fireEvent.click(screen.getByTestId('toggle-review-controls'));
      fireEvent.click(screen.getByTestId('toggle-local-json-inspector'));

      const krSample = RECORDED_REVIEW_PROFILES.kr_mid_specialist;
      fireEvent.change(screen.getByTestId('local-json-textarea'), {
        target: {
          value: JSON.stringify({
            puuid: krSample.puuid,
            region: krSample.region,
            gameName: 'OfflineJsonUser',
            tagLine: 'LOCAL',
            visibleMatches: krSample.visibleMatches,
            timelinesByMatchId: {},
          }),
        },
      });
      fireEvent.click(screen.getByTestId('apply-local-json-btn'));

      expect(screen.getByTestId('profile-pro-comparison-tab')).toHaveAttribute(
        'data-source-mode',
        'local_json'
      );
      const localJsonBtn = screen.getByTestId('load-pair-timelines-btn') as HTMLButtonElement;
      expect(localJsonBtn).toBeDisabled();
      expect(localJsonBtn).toHaveTextContent(
        '0/1G timelines · Missing match timeline (1G · Offline)'
      );
      expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent(
        'Missing match timeline (Offline)'
      );

      fireEvent.click(localJsonBtn);
      localJsonBtn.disabled = false;
      fireEvent.click(localJsonBtn);
      localJsonBtn.disabled = true;

      previewRender.unmount();

      // 3. Direct ProfileProComparisonTab renders in synthetic_test_profile and local_json WITHOUT fetchTimeline prop override
      const euwSample = RECORDED_REVIEW_PROFILES.euw_top_specialist;
      for (const offlineMode of ['synthetic_test_profile', 'local_json'] as const) {
        const directRender = render(
          <ProfileProComparisonTab
            puuid={euwSample.puuid}
            region={euwSample.region}
            gameName={euwSample.gameName}
            tagLine={euwSample.tagLine}
            visibleMatches={euwSample.visibleMatches}
            initialTimelinesByMatchId={{}}
            dataSourceMode={offlineMode}
          />
        );
        const btn = screen.getByTestId('load-pair-timelines-btn') as HTMLButtonElement;
        expect(btn).toBeDisabled();
        expect(btn).toHaveTextContent('Missing match timeline (3G · Offline)');
        expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent(
          'Missing match timeline (Offline)'
        );

        fireEvent.click(btn);
        btn.disabled = false;
        fireEvent.click(btn);
        directRender.unmount();
      }

      expect(getMatchTimelineSpy).not.toHaveBeenCalled();
      expect(apiClientGetSpy).not.toHaveBeenCalled();
      expect(globalFetchSpy).not.toHaveBeenCalled();

      // 4. Confirm public live_profile default path remains completely intact and uses timelineApi.getMatchTimeline on click
      getMatchTimelineSpy.mockImplementation(async (_region: string, matchId: string) => {
        return krSample.timelinesByMatchId[matchId] ?? null;
      });

      const liveRender = render(
        <ProfileProComparisonTab
          puuid={krSample.puuid}
          region={krSample.region}
          gameName={krSample.gameName}
          tagLine={krSample.tagLine}
          visibleMatches={krSample.visibleMatches}
          initialTimelinesByMatchId={{}}
          dataSourceMode="live_profile"
          initialScope="champion_pair"
        />
      );

      const liveBtn = screen.getByTestId('load-pair-timelines-btn') as HTMLButtonElement;
      expect(liveBtn).not.toBeDisabled();
      expect(liveBtn).toHaveTextContent('Load Timelines (1G)');
      expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent('Load Timeline');

      fireEvent.click(liveBtn);
      await waitFor(() => {
        expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('94.0');
      });
      expect(getMatchTimelineSpy).toHaveBeenCalledTimes(1);
      expect(getMatchTimelineSpy).toHaveBeenCalledWith('KR', 'KR_8102001');
      expect(apiClientGetSpy).not.toHaveBeenCalled();

      liveRender.unmount();
    } finally {
      getMatchTimelineSpy.mockRestore();
      apiClientGetSpy.mockRestore();
      globalFetchSpy.mockRestore();
    }
  });

  it('uses plain League labels (Sample options, Import sample data, Try a CS value, Compare by role) and never leaks developer/JSON/DTO/schema/contract/enum/fixture/payload/demo/role-first/null jargon across controls, missing states, errors, catalog, and help', async () => {
    const FORBIDDEN_UI_TOKENS = [
      'Developer',
      'JSON',
      'Demo',
      'Role-First',
      'ROLE-FIRST',
      'Review Controls',
      'MatchDto',
      'MatchTimelineDto',
      'ChallengesDto',
      'challenges.',
      'puuid',
      'visibleMatches',
      'timelinesByMatchId',
      'finalDeaths',
      'finalGold',
      'goldEarned',
      'pGolds',
      'pLevels',
      'aligned_checkpoints',
      'minionsKilled',
      'jungleMinionsKilled',
      'participantFrames',
      'assistingParticipantIds',
      'livestats',
      'lolesports',
      'gameState',
      '/details',
      'Data Dragon',
      'UNAVAILABLE',
      'unloaded in fixture',
      'missing in JSON',
      'pairs in JSON',
      'FullContract',
      'SummonerInfo',
      'RankedInfo',
      'ImprovementStatsSection',
      'EUW1_FULL_',
      'EUW1_720',
      'KR_810',
      // Internal Riot / Data Dragon champion IDs must never appear in visible labels
      'KSante',
      'MonkeyKing',
      'FiddleSticks',
      'AurelionSol',
      'JarvanIV',
      'LeeSin',
      'XinZhao',
      'Kaisa',
      'KaiSa',
      'DrMundo',
      'RekSai',
      'TahmKench',
      'TwistedFate',
      'MasterYi',
      'MissFortune',
      'KogMaw',
      'ChoGath',
      'Chogath',
      'KhaZix',
      'Khazix',
      'VelKoz',
      'Velkoz',
      'BelVeth',
      'Belveth',
      'Leblanc',
    ];

    const FORBIDDEN_WORD_REGEXES = [
      /\bnull\b/i,
      /\bfixture\b/i,
      /\bcontract\b/i,
      /\bschema\b/i,
      /\benum\b/i,
      /\bpayload\b/i,
      /\bdeveloper\b/i,
      /\bjson\b/i,
      /\bdemo\b/i,
      /\bendpoint\b/i,
      /\bdataset\b/i,
      /\bobservation(s)?\b/i,
      /\bheuristic\b/i,
      /\bnaive\b/i,
    ];

    const assertZeroTechnicalTokensInDom = (root: HTMLElement, stateLabel: string) => {
      const visibleText = root.textContent ?? '';
      const attrText = Array.from(
        root.querySelectorAll('[aria-label], [title], [placeholder]')
      )
        .map(
          (el) =>
            `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''} ${
              el.getAttribute('placeholder') ?? ''
            }`
        )
        .join(' ');
      const combined = `${visibleText}\n${attrText}`;

      for (const token of FORBIDDEN_UI_TOKENS) {
        expect(combined, `Forbidden token "${token}" leaked in ${stateLabel}`).not.toContain(token);
      }
      for (const pattern of FORBIDDEN_WORD_REGEXES) {
        expect(combined, `Forbidden pattern ${pattern} leaked in ${stateLabel}`).not.toMatch(
          pattern
        );
      }
    };

    // 1. Default Profile surface (Ironclad#EUW): verify Compare by role + Sample options + Import sample data + Try a CS value
    const profileRender = render(<ProComparisonPreview initialSurface="profile" />);
    expect(screen.getByTestId('recent20-window-strip')).toHaveTextContent('Compare by role');
    expect(screen.getByTestId('toggle-review-controls')).toHaveTextContent('Sample options');
    expect(screen.getByTestId('pro-comparison-datasource-badge')).toHaveTextContent(
      'Sample player · Not real account data (Offline)'
    );
    expect(screen.getByTestId('excluded-metric-status-soloKills')).toHaveTextContent(
      'Not available'
    );
    expect(screen.getByTestId('load-pair-timelines-btn')).toHaveTextContent(
      'Missing match timeline'
    );

    // Verify player-pair-select displays "K'Sante" while keeping underlying value="top::KSante"
    const pairSelect = screen.getByTestId('player-pair-select') as HTMLSelectElement;
    const ksanteOption = Array.from(pairSelect.options).find((o) => o.value === 'top::KSante');
    expect(ksanteOption).toBeDefined();
    expect(ksanteOption?.textContent).toContain("K'Sante · Top");

    const matchSelect = screen.getByTestId('player-match-scope-select') as HTMLSelectElement;
    expect(matchSelect.textContent).toContain("Game 1 · K'Sante");

    fireEvent.click(screen.getByTestId('toggle-profile-match-breakdown'));
    fireEvent.click(screen.getByTestId('toggle-profile-methodology'));
    expect(screen.getByTestId('surface-mode-catalog-btn')).toHaveTextContent(
      'Browse pro stats (53)'
    );
    expect(screen.getByTestId('surface-mode-demo-btn')).toHaveTextContent('Try a CS value');

    fireEvent.click(screen.getByTestId('toggle-review-controls'));
    expect(screen.getByTestId('toggle-review-controls')).toHaveTextContent('Hide sample options');
    expect(screen.getByTestId('toggle-local-json-inspector')).toHaveTextContent(
      'Import sample data'
    );
    expect(screen.getByTestId('mode-btn-demo-input')).toHaveTextContent('Try a CS value');

    assertZeroTechnicalTokensInDom(
      profileRender.container,
      'default Ironclad#EUW + breakdown + methodology + sample options'
    );

    // 2. Open "Import sample data" panel AND trigger both parse-error and missing-fields alerts
    fireEvent.click(screen.getByTestId('toggle-local-json-inspector'));
    expect(screen.getByTestId('toggle-local-json-inspector')).toHaveTextContent(
      'Hide sample import'
    );
    expect(screen.getByTestId('apply-local-json-btn')).toHaveTextContent('Load sample data');
    assertZeroTechnicalTokensInDom(profileRender.container, 'opened Import sample data panel');

    fireEvent.change(screen.getByTestId('local-json-textarea'), {
      target: { value: '{broken' },
    });
    fireEvent.click(screen.getByTestId('apply-local-json-btn'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not read sample match data. Check the format and try again.'
    );
    assertZeroTechnicalTokensInDom(profileRender.container, 'Import sample data parse error alert');

    fireEvent.change(screen.getByTestId('local-json-textarea'), {
      target: { value: '{}' },
    });
    fireEvent.click(screen.getByTestId('apply-local-json-btn'));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sample match data must include a player ID and recent matches.'
    );
    assertZeroTechnicalTokensInDom(
      profileRender.container,
      'Import sample data missing fields alert'
    );
    fireEvent.click(screen.getByTestId('toggle-local-json-inspector'));

    // 3. Check Overview tab placeholder copy
    fireEvent.click(screen.getByTestId('review-profile-tab-overview'));
    assertZeroTechnicalTokensInDom(profileRender.container, 'overview tab placeholder');
    fireEvent.click(screen.getByTestId('review-profile-tab-pro-comparison'));

    // 4. Switch to "Browse pro stats" (pro_catalog) and "Try a CS value" (manual_demo) inside ProfileProComparisonTab
    fireEvent.click(screen.getByTestId('toggle-profile-methodology'));
    fireEvent.click(screen.getByTestId('surface-mode-catalog-btn'));
    fireEvent.click(screen.getByRole('button', { name: 'All Roles' }));
    const catalogSelect = screen.getByTestId('catalog-champion-select') as HTMLSelectElement;
    const ksanteCatalogOpt = Array.from(catalogSelect.options).find((o) => o.value === 'KSante');
    expect(ksanteCatalogOpt).toBeDefined();
    expect(ksanteCatalogOpt?.textContent).toContain("K'Sante (Top");
    const wukongCatalogOpt = Array.from(catalogSelect.options).find(
      (o) => o.value === 'MonkeyKing'
    );
    expect(wukongCatalogOpt).toBeDefined();
    expect(wukongCatalogOpt?.textContent).toContain('Wukong (Jungle');
    assertZeroTechnicalTokensInDom(profileRender.container, 'Browse pro stats catalog mode (all 53)');

    fireEvent.click(screen.getByTestId('surface-mode-demo-btn'));
    expect(screen.getByTestId('manual-demo-fallback-banner')).toHaveTextContent('Try a CS value');
    assertZeroTechnicalTokensInDom(profileRender.container, 'Try a CS value mode in profile tab');
    fireEvent.click(screen.getByTestId('surface-mode-player-btn'));

    // 5. Missing timeline + unsupported pro matchup state (Top · Garen -> Game 2 unloaded)
    fireEvent.change(screen.getByTestId('player-pair-select'), {
      target: { value: 'top::Garen' },
    });
    expect(screen.getByTestId('recent20-window-strip')).toHaveTextContent(
      'Compare by champion & role'
    );
    fireEvent.change(screen.getByTestId('player-match-scope-select'), {
      target: { value: 'EUW1_FULL_016' },
    });
    expect(screen.getByTestId('player-unavailable-10m')).toHaveTextContent(
      'Missing match timeline (Offline)'
    );
    expect(screen.getByTestId('pro-unavailable-10m')).toHaveTextContent('No Pro Sample');
    assertZeroTechnicalTokensInDom(
      profileRender.container,
      'missing match timeline + unsupported matchup'
    );

    // 6. Paused pro game excluded state (Mid · Syndra · IG Rookie)
    fireEvent.change(screen.getByTestId('player-role-select'), {
      target: { value: 'mid' },
    });
    fireEvent.change(screen.getByTestId('player-pair-select'), {
      target: { value: 'mid::Syndra' },
    });
    fireEvent.change(screen.getByTestId('player-pro-select'), {
      target: { value: '99566404811346612' },
    });
    expect(screen.getByTestId('pro-early-deaths-unavailable-10m')).toHaveTextContent(
      'Paused game excluded'
    );
    assertZeroTechnicalTokensInDom(profileRender.container, 'paused pro game excluded');

    // 7. Legacy partial sample player (BladeRunner#EUW) -> Unknown preserved (never hidden or 0)
    fireEvent.click(screen.getByTestId('switch-review-player-euw'));
    expect(screen.getByTestId('whole-game-player-killParticipation')).toHaveTextContent('Unknown');
    expect(screen.getByTestId('whole-game-player-championDamageShare')).toHaveTextContent(
      'Unknown'
    );
    expect(screen.getByTestId('whole-game-player-totalDeaths')).toHaveTextContent('Unknown');
    assertZeroTechnicalTokensInDom(profileRender.container, 'BladeRunner#EUW Unknown team stats');

    profileRender.unmount();

    // 8. Standalone Reference + Try a CS value + Per-Game Evidence + Methodology & Limits + Display-name search
    const standaloneRender = render(<ProComparisonPreview initialSurface="standalone" />);
    expect(screen.getByTestId('mode-btn-demo-input')).toHaveTextContent('Try a CS value');
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent('Not available');
    expect(screen.getByTestId('active-selection-title')).toHaveTextContent("Top · K'Sante");
    fireEvent.click(screen.getByTestId('btn-toggle-evidence'));
    fireEvent.click(screen.getByTestId('btn-toggle-methodology'));
    fireEvent.click(screen.getByTestId('mode-btn-demo-input'));
    fireEvent.click(screen.getByTestId('btn-fill-synthetic-demo'));
    assertZeroTechnicalTokensInDom(
      standaloneRender.container,
      'standalone reference + Try a CS value + evidence + methodology'
    );

    // Searching by player-facing display name "Wukong" resolves to Jungle · Wukong (underlying MonkeyKing)
    fireEvent.click(screen.getByTestId('role-pill-jungle'));
    fireEvent.change(screen.getByTestId('pro-champion-search'), { target: { value: 'Wukong' } });
    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('Jungle · Wukong');
    assertZeroTechnicalTokensInDom(standaloneRender.container, 'standalone Wukong search');

    fireEvent.change(screen.getByTestId('pro-champion-search'), {
      target: { value: 'FiddleSticks' },
    });
    expect(screen.getByTestId('unsupported-selection-state')).toHaveTextContent('Fiddlesticks');
    assertZeroTechnicalTokensInDom(
      standaloneRender.container,
      'standalone unsupported Fiddlesticks search'
    );

    fireEvent.change(screen.getByTestId('pro-champion-search'), {
      target: { value: 'AurelionSol' },
    });
    expect(screen.getByTestId('unsupported-selection-state')).toHaveTextContent('Aurelion Sol');
    assertZeroTechnicalTokensInDom(
      standaloneRender.container,
      'standalone unsupported Aurelion Sol search'
    );
    standaloneRender.unmount();

    // 9. Empty matches state + live_profile timeline load error alert
    const krSample = RECORDED_REVIEW_PROFILES.kr_mid_specialist;
    const emptyRender = render(
      <ProfileProComparisonTab
        puuid={krSample.puuid}
        region={krSample.region}
        gameName="ArenaOnly"
        tagLine="KR1"
        visibleMatches={[]}
        initialTimelinesByMatchId={{}}
        dataSourceMode="synthetic_test_profile"
      />
    );
    assertZeroTechnicalTokensInDom(emptyRender.container, 'empty role matches state');
    emptyRender.unmount();

    const failingLiveRender = render(
      <ProfileProComparisonTab
        puuid={krSample.puuid}
        region={krSample.region}
        gameName={krSample.gameName}
        tagLine={krSample.tagLine}
        visibleMatches={krSample.visibleMatches}
        initialTimelinesByMatchId={{}}
        dataSourceMode="live_profile"
        fetchTimeline={async () => null}
      />
    );
    fireEvent.click(screen.getByTestId('load-pair-timelines-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('timeline-fetch-error')).toBeInTheDocument();
    });
    assertZeroTechnicalTokensInDom(failingLiveRender.container, 'live timeline fetch error alert');
    failingLiveRender.unmount();
  });

  it('formats all Riot internal champion IDs (including KSante, MonkeyKing, FiddleSticks, AurelionSol) to player-facing names while preserving underlying IDs', () => {
    expect(formatChampionDisplayName('KSante')).toBe("K'Sante");
    expect(formatChampionDisplayName('MonkeyKing')).toBe('Wukong');
    expect(formatChampionDisplayName('FiddleSticks')).toBe('Fiddlesticks');
    expect(formatChampionDisplayName('AurelionSol')).toBe('Aurelion Sol');
    expect(formatChampionDisplayName('JarvanIV')).toBe('Jarvan IV');
    expect(formatChampionDisplayName('LeeSin')).toBe('Lee Sin');
    expect(formatChampionDisplayName('XinZhao')).toBe('Xin Zhao');
    expect(formatChampionDisplayName('Kaisa')).toBe("Kai'Sa");
    expect(formatChampionDisplayName('KaiSa')).toBe("Kai'Sa");
    expect(formatChampionDisplayName('Renata')).toBe('Renata Glasc');
    expect(formatChampionDisplayName('Nunu')).toBe('Nunu & Willump');
    expect(formatChampionDisplayName('DrMundo')).toBe('Dr. Mundo');
    expect(formatChampionDisplayName('RekSai')).toBe("Rek'Sai");
    expect(formatChampionDisplayName('BelVeth')).toBe("Bel'Veth");
    expect(formatChampionDisplayName('ChoGath')).toBe("Cho'Gath");
    expect(formatChampionDisplayName('KhaZix')).toBe("Kha'Zix");
    expect(formatChampionDisplayName('KogMaw')).toBe("Kog'Maw");
    expect(formatChampionDisplayName('VelKoz')).toBe("Vel'Koz");
    expect(formatChampionDisplayName('TahmKench')).toBe('Tahm Kench');
    expect(formatChampionDisplayName('TwistedFate')).toBe('Twisted Fate');
    expect(formatChampionDisplayName('MasterYi')).toBe('Master Yi');
    expect(formatChampionDisplayName('MissFortune')).toBe('Miss Fortune');
    expect(formatChampionDisplayName('Leblanc')).toBe('LeBlanc');
    expect(formatChampionDisplayName('ALL')).toBe('ALL');

    const wukongSlice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'jungle',
      championId: 'Wukong',
    });
    expect(wukongSlice.isSupportedSelection).toBe(true);
    expect(wukongSlice.filter.championId).toBe('MonkeyKing');
    expect(wukongSlice.selectionTitle).toBe('Jungle · Wukong');
  });
});




