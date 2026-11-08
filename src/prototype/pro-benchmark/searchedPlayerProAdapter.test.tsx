import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CHECKPOINT_TOLERANCE_MS,
  buildSearchedPlayerProComparison,
  clearSharedProTimelineCacheForTests,
  extractPlayerMatchSummary,
  resolvePlayerMatchParticipant,
  resolveTimelineParticipantIdByPuuid,
  sharedTimelineCache,
} from './searchedPlayerProAdapter';
import { ProfileProComparisonTab } from './ProfileProComparisonTab';
import { RECORDED_REVIEW_PROFILES } from './recordedPlayerContractSample';
import ProComparisonPreview from './ProComparisonPreview';
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

  it('clears stale selection and binds to new player identity when searched player changes, and supports individual match scope', () => {
    render(<ProComparisonPreview initialSurface="profile" />);

    expect(screen.getByTestId('pro-comparison-identity-badge')).toHaveTextContent(
      'BladeRunner#EUW (EUW1)'
    );
    expect(screen.getByTestId('pro-comparison-datasource-badge')).toHaveTextContent(
      'Synthetic test profile / Not real player data'
    );
    expect(screen.getByTestId('paired-selection-title')).toHaveTextContent('Top · KSante');
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('87.0');

    // Switch to individual match EUW1_7201001
    fireEvent.change(screen.getByTestId('player-match-scope-select'), {
      target: { value: 'EUW1_7201001' },
    });
    expect(screen.getByTestId('player-denom-10m')).toHaveTextContent('1/1G');
    expect(screen.getByTestId('player-mean-cs-10m')).toHaveTextContent('90.0');

    // Open Review Controls and switch synthetic test profile to ArcaneWave#KR1 -> clears stale Top/KSante selection and binds to Mid/Syndra
    fireEvent.click(screen.getByTestId('toggle-review-controls'));
    fireEvent.click(screen.getByTestId('switch-review-player-kr'));
    expect(screen.getByTestId('pro-comparison-identity-badge')).toHaveTextContent(
      'ArcaneWave#KR1 (KR)'
    );
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
      />
    );

    fireEvent.click(screen.getByTestId('load-pair-timelines-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('timeline-fetch-error')).toHaveTextContent(
        'Could not load 1 of 1 match timeline(s) from the timeline endpoint.'
      );
    });
    expect(screen.getByTestId('timeline-fetch-error').textContent).not.toContain('memory guard');
  });
});
