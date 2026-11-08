import { describe, expect, it } from "vitest";
import {
  buildCoachProComparisonContext,
  extractRawTimelineAssistAudit,
  extractStrictPlayerChallengeMetrics,
} from "./coachProComparisonContext";
import { SYNTHETIC_TEST_PROFILES } from "./recordedPlayerContractSample";
import type { MatchDto, ParticipantDto } from "../../types/match";
import type { MatchTimelineDto } from "../../types/timeline";

function createTenPlayerSyndraMatchWithChallenges(params: {
  matchId: string;
  puuid: string;
  soloKills?: number | null;
  turretPlatesTaken?: number | null;
  oppTurretPlatesTaken?: number | null;
  laneMinionsFirst10Minutes?: number | null;
  controlWardsPlaced?: number | null;
}): MatchDto {
  const mkParticipant = (
    pid: number,
    puuid: string,
    teamId: number,
    role: string,
    champ: string,
    kills: number,
    deaths: number,
    assists: number,
    dmg: number,
    wardsPlaced: number,
    wardsKilled: number,
    challenges?: ParticipantDto["challenges"],
  ): ParticipantDto => ({
    participantId: pid,
    puuid,
    teamId,
    teamPosition: role,
    individualPosition: role,
    championName: champ,
    championId: pid,
    win: teamId === 100,
    kills,
    deaths,
    assists,
    totalMinionsKilled: 240,
    neutralMinionsKilled: 12,
    goldEarned: 14500,
    champLevel: 16,
    totalDamageDealtToChampions: dmg,
    wardsPlaced,
    wardsKilled,
    visionScore: 28,
    item0: 3078,
    item1: 3006,
    item2: 3031,
    item3: 3094,
    item4: 3036,
    item5: 3026,
    item6: 3363,
    ...(challenges !== undefined ? { challenges } : {}),
  });

  const playerChallenges: ParticipantDto["challenges"] | undefined =
    params.soloKills !== undefined ||
    params.turretPlatesTaken !== undefined ||
    params.laneMinionsFirst10Minutes !== undefined ||
    params.controlWardsPlaced !== undefined
      ? {
          ...(params.soloKills !== null && params.soloKills !== undefined
            ? { soloKills: params.soloKills }
            : {}),
          ...(params.turretPlatesTaken !== null &&
          params.turretPlatesTaken !== undefined
            ? { turretPlatesTaken: params.turretPlatesTaken }
            : {}),
          ...(params.laneMinionsFirst10Minutes !== null &&
          params.laneMinionsFirst10Minutes !== undefined
            ? { laneMinionsFirst10Minutes: params.laneMinionsFirst10Minutes }
            : {}),
          ...(params.controlWardsPlaced !== null &&
          params.controlWardsPlaced !== undefined
            ? { controlWardsPlaced: params.controlWardsPlaced }
            : {}),
        }
      : undefined;

  const oppChallenges: ParticipantDto["challenges"] | undefined =
    params.oppTurretPlatesTaken !== null &&
    params.oppTurretPlatesTaken !== undefined
      ? { turretPlatesTaken: params.oppTurretPlatesTaken }
      : undefined;

  return {
    metadata: {
      matchId: params.matchId,
      participants: [
        "puuid-b1",
        "puuid-b2",
        params.puuid,
        "puuid-b4",
        "puuid-b5",
        "puuid-r1",
        "puuid-r2",
        "puuid-r3",
        "puuid-r4",
        "puuid-r5",
      ],
    },
    info: {
      gameId: 555001,
      gameCreation: 1762000000000,
      gameDuration: 1800, // 30:00
      gameMode: "CLASSIC",
      gameVersion: "16.20.826.3891",
      queueId: 420,
      participants: [
        mkParticipant(1, "puuid-b1", 100, "TOP", "KSante", 2, 3, 7, 20000, 12, 4),
        mkParticipant(2, "puuid-b2", 100, "JUNGLE", "LeeSin", 4, 2, 9, 15000, 15, 8),
        // Player (pid 3): 8 kills + 6 assists = 14/20 (0.70 KP); 30000 / 100000 = 0.30 damage share
        mkParticipant(
          3,
          params.puuid,
          100,
          "MIDDLE",
          "Syndra",
          8,
          2,
          6,
          30000,
          15,
          6,
          playerChallenges,
        ),
        mkParticipant(4, "puuid-b4", 100, "BOTTOM", "Ezreal", 5, 2, 6, 25000, 14, 5),
        mkParticipant(5, "puuid-b5", 100, "UTILITY", "Nautilus", 1, 4, 12, 10000, 45, 12),
        mkParticipant(6, "puuid-r1", 200, "TOP", "Rumble", 2, 3, 4, 18000, 11, 3),
        mkParticipant(7, "puuid-r2", 200, "JUNGLE", "XinZhao", 3, 4, 5, 14000, 12, 7),
        mkParticipant(
          8,
          "puuid-r3",
          200,
          "MIDDLE",
          "Cassiopeia",
          3,
          4,
          4,
          24000,
          13,
          4,
          oppChallenges,
        ),
        mkParticipant(9, "puuid-r4", 200, "BOTTOM", "Varus", 3, 5, 3, 22000, 12, 5),
        mkParticipant(10, "puuid-r5", 200, "UTILITY", "Rakan", 1, 4, 8, 8000, 40, 10),
      ],
    },
  };
}

describe("coachProComparisonContext adapter contract & data integrity", () => {
  it("preserves missing challenges as null (unknown_missing_challenge), never 0", () => {
    const profile = SYNTHETIC_TEST_PROFILES.euw_top_specialist;
    const matchWithoutChallenges = profile.visibleMatches[0];
    const playerParticipant = matchWithoutChallenges.info!.participants.find(
      (p) => p.puuid === profile.puuid,
    )!;

    const extracted = extractStrictPlayerChallengeMetrics(playerParticipant, null);
    expect(extracted.soloKillsStatus).toBe("unknown_missing_challenge");
    expect(extracted.soloKills).toBeNull();
    expect(extracted.turretPlatesTakenStatus).toBe("unknown_missing_challenge");
    expect(extracted.turretPlatesTaken).toBeNull();
    expect(extracted.opponentTurretPlatesTakenStatus).toBe("opponent_not_resolved");
    expect(extracted.opponentTurretPlatesTaken).toBeNull();
    expect(extracted.laneMinionsFirst10MinutesStatus).toBe(
      "unknown_missing_challenge",
    );
    expect(extracted.laneMinionsFirst10Minutes).toBeNull();
    expect(extracted.jungleCsBefore10MinutesStatus).toBe(
      "unknown_missing_challenge",
    );
    expect(extracted.jungleCsBefore10Minutes).toBeNull();
    expect(extracted.controlWardsPlacedStatus).toBe("unknown_missing_challenge");
    expect(extracted.controlWardsPlaced).toBeNull();
    expect(extracted.proReference).toBeNull();
  });

  it("preserves missing assistingParticipantIds on CHAMPION_KILL events as null (unknown), never 0 or solo", () => {
    const timelineWithNullAssist: MatchTimelineDto = {
      metadata: {
        matchId: "EUW1_TEST_ASSIST",
        participants: ["puuid-1", "puuid-2", "puuid-3", "puuid-4"],
      },
      info: {
        frameInterval: 60000,
        participants: [
          { participantId: 1, puuid: "puuid-1" },
          { participantId: 2, puuid: "puuid-2" },
          { participantId: 3, puuid: "puuid-3" },
          { participantId: 4, puuid: "puuid-4" },
        ],
        frames: [
          {
            timestamp: 300_000,
            participantFrames: {},
            events: [
              // 1) Explicit zero-assist death: assistingParticipantIds: []
              {
                type: "CHAMPION_KILL",
                timestamp: 240_000,
                killerId: 9,
                victimId: 4,
                assistingParticipantIds: [],
              },
              // 2) Missing assistingParticipantIds (null) on second death -> must make match-level assisted/zeroAssist null!
              {
                type: "CHAMPION_KILL",
                timestamp: 290_000,
                killerId: 9,
                victimId: 4,
                assistingParticipantIds: null as unknown as number[],
              },
              // 3) Player kill with missing assistingParticipantIds (undefined)
              {
                type: "CHAMPION_KILL",
                timestamp: 295_000,
                killerId: 4,
                victimId: 9,
              },
            ],
          },
        ],
      },
    };

    const audit = extractRawTimelineAssistAudit(timelineWithNullAssist, 4, 1800);
    expect(audit.status).toBe("available");
    expect(audit.totalDeaths).toBe(2);
    // Because 1 death had null assistingParticipantIds, match-level assistedDeaths and
    // zeroAssistDeathsNotProvenSolo MUST be null (unknown), never 0 or deflated 1!
    expect(audit.unknownAssistDeathsCount).toBe(1);
    expect(audit.knownZeroAssistDeathsPartialCount).toBe(1);
    expect(audit.knownAssistedDeathsPartialCount).toBe(0);
    expect(audit.assistedDeaths).toBeNull();
    expect(audit.zeroAssistDeathsNotProvenSolo).toBeNull();

    // Same for player kills where assistingParticipantIds was omitted
    expect(audit.totalKills).toBe(1);
    expect(audit.unknownAssistKillsCount).toBe(1);
    expect(audit.assistedKills).toBeNull();
    expect(audit.zeroAssistKillsNotProvenSolo).toBeNull();

    // Solo kills / solo deaths from timeline are always null (0 assists != proven 1v1)
    expect(audit.soloKillsFromTimeline).toBeNull();
    expect(audit.soloDeathsFromTimeline).toBeNull();
  });

  it("computes exact assisted and zero-assist counts when all CHAMPION_KILL events have explicit assistingParticipantIds arrays, while keeping soloKillsFromTimeline/soloDeathsFromTimeline null", () => {
    const timelineWithCompleteAssists: MatchTimelineDto = {
      metadata: {
        matchId: "EUW1_TEST_COMPLETE_ASSIST",
        participants: ["puuid-4"],
      },
      info: {
        frameInterval: 60000,
        participants: [{ participantId: 4, puuid: "puuid-4" }],
        frames: [
          {
            timestamp: 600_000,
            participantFrames: {},
            events: [
              {
                type: "CHAMPION_KILL",
                timestamp: 200_000,
                killerId: 9,
                victimId: 4,
                assistingParticipantIds: [],
              },
              {
                type: "CHAMPION_KILL",
                timestamp: 450_000,
                killerId: 9,
                victimId: 4,
                assistingParticipantIds: [7, 10],
              },
              {
                type: "CHAMPION_KILL",
                timestamp: 520_000,
                killerId: 4,
                victimId: 9,
                assistingParticipantIds: [],
              },
            ],
          },
        ],
      },
    };

    const audit = extractRawTimelineAssistAudit(
      timelineWithCompleteAssists,
      4,
      1800,
    );
    expect(audit.status).toBe("available");
    expect(audit.totalDeaths).toBe(2);
    expect(audit.unknownAssistDeathsCount).toBe(0);
    expect(audit.assistedDeaths).toBe(1);
    expect(audit.zeroAssistDeathsNotProvenSolo).toBe(1);
    expect(audit.totalKills).toBe(1);
    expect(audit.unknownAssistKillsCount).toBe(0);
    expect(audit.assistedKills).toBe(0);
    expect(audit.zeroAssistKillsNotProvenSolo).toBe(1);
    expect(audit.soloKillsFromTimeline).toBeNull();
    expect(audit.soloDeathsFromTimeline).toBeNull();
  });

  it("builds full coach pro-comparison context with labeled player vs pro, champion/role/patch/windows/counts, team damage share, full 5m-30m gold/level/CS/diff curves, and unsupported metrics", () => {
    const puuid = "puuid-player-syndra-1";
    // Give match 1 explicit challenges (soloKills: 2, turretPlatesTaken: 3) and leave match 2 without challenges (undefined)
    const match1 = createTenPlayerSyndraMatchWithChallenges({
      matchId: "EUW1_555001",
      puuid,
      soloKills: 2,
      turretPlatesTaken: 3,
      oppTurretPlatesTaken: 1,
      laneMinionsFirst10Minutes: 92,
      controlWardsPlaced: 2,
    });
    const match2 = createTenPlayerSyndraMatchWithChallenges({
      matchId: "EUW1_555002",
      puuid,
      // All challenges omitted on match 2 -> must stay null, never 0!
    });

    const mkSyndraCassTimeline = (
      matchId: string,
      hasEarlyDeathAt4m: boolean,
    ): MatchTimelineDto => ({
      metadata: {
        matchId,
        participants: [puuid, "puuid-r3"],
      },
      info: {
        frameInterval: 60_000,
        participants: [
          { participantId: 3, puuid },
          { participantId: 8, puuid: "puuid-r3" },
        ],
        frames: [
          {
            timestamp: 300_000,
            participantFrames: {
              "3": {
                participantId: 3,
                totalGold: 1850,
                level: 5,
                xp: 2100,
                currentGold: 400,
                minionsKilled: 40,
                jungleMinionsKilled: 0,
                position: { x: 7000, y: 7000 },
              },
              "8": {
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
            events: hasEarlyDeathAt4m
              ? [
                  {
                    type: "CHAMPION_KILL",
                    timestamp: 250_000,
                    killerId: 8,
                    victimId: 3,
                    assistingParticipantIds: [7],
                  },
                ]
              : [],
          },
          {
            timestamp: 600_000,
            participantFrames: {
              "3": {
                participantId: 3,
                totalGold: 3800,
                level: 9,
                xp: 5200,
                currentGold: 600,
                minionsKilled: 92,
                jungleMinionsKilled: 2,
                position: { x: 7000, y: 7000 },
              },
              "8": {
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
            events: [],
          },
          {
            timestamp: 900_000,
            participantFrames: {
              "3": {
                participantId: 3,
                totalGold: 5900,
                level: 11,
                xp: 8100,
                currentGold: 700,
                minionsKilled: 146,
                jungleMinionsKilled: 4,
                position: { x: 7000, y: 7000 },
              },
              "8": {
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
            events: [],
          },
          {
            timestamp: 1_200_000,
            participantFrames: {
              "3": {
                participantId: 3,
                totalGold: 8120,
                level: 13,
                xp: 10400,
                currentGold: 700,
                minionsKilled: 184,
                jungleMinionsKilled: 8,
                position: { x: 7000, y: 7000 },
              },
              "8": {
                participantId: 8,
                totalGold: 7800,
                level: 13,
                xp: 10100,
                currentGold: 500,
                minionsKilled: 176,
                jungleMinionsKilled: 4,
                position: { x: 7200, y: 7200 },
              },
            },
            events: [],
          },
          {
            timestamp: 1_500_000,
            participantFrames: {
              "3": {
                participantId: 3,
                totalGold: 10740,
                level: 15,
                xp: 13800,
                currentGold: 800,
                minionsKilled: 228,
                jungleMinionsKilled: 12,
                position: { x: 7000, y: 7000 },
              },
              "8": {
                participantId: 8,
                totalGold: 10200,
                level: 14,
                xp: 13100,
                currentGold: 600,
                minionsKilled: 215,
                jungleMinionsKilled: 8,
                position: { x: 7200, y: 7200 },
              },
            },
            events: [],
          },
        ],
      },
    });

    const ctx = buildCoachProComparisonContext({
      puuid,
      region: "EUW1",
      gameName: "MidTester",
      tagLine: "EUW",
      matches: [match1, match2],
      timelinesByMatchId: {
        EUW1_555001: mkSyndraCassTimeline("EUW1_555001", true),
        EUW1_555002: mkSyndraCassTimeline("EUW1_555002", false),
      },
    });

    expect(ctx.schemaVersion).toBe("coach-pro-comparison-v1");
    expect(ctx.dataIntegrityRules).toEqual({
      recentMatchWindowPolicy: "most_recent_20_deduplicated_matches_only",
      roleSelectionScopePolicy:
        "enforce_selected_or_preselected_role_with_separate_all_roles_metadata",
      missingChallengesPolicy: "preserve_null_unknown_never_zero",
      missingTimelineAssistsPolicy: "preserve_null_unknown_never_zero_or_solo",
      unassistedKillDeathPolicy:
        "zero_recorded_assists_is_not_proven_1v1_solo",
      proEarlyDeathsPausePolicy:
        "exclude_paused_pro_games_with_total_pause_gt_0",
      proPlayerFilterPolicy: "never_fabricate_pro_player_availability",
    });

    expect(ctx.proDatasetMetadata).toEqual({
      patchVersion: "16.20.826.3891",
      gamesIngestedCount: 8,
      playerObservationsCount: 80,
      unpausedGamesCountForEarlyDeaths: 7,
      unpausedPlayerObservationsCountForEarlyDeaths: 70,
      pausedGamesExcludedFromEarlyDeathsCount: 1,
      pausedPlayerObservationsExcludedFromEarlyDeathsCount: 10,
      earlyDeaths5mTo20mMaxUnpausedObservations: 70,
      supportedChampionRolePairsCount: 53,
    });

    // Verify recentMatchWindow, roleSelection, and proPlayerSelection on default context
    expect(ctx.recentMatchWindow).toEqual({
      maxRecentMatches: 20,
      timestampSortPolicy:
        "known_timestamps_newest_first_then_unknown_in_input_order",
      inputMatchCount: 2,
      duplicateMatchesExcludedCount: 0,
      knownTimestampMatchCountInInput: 2,
      unknownTimestampMatchCountInInput: 0,
      analyzedRecentMatchCount: 2,
      knownTimestampMatchCountInRecent20: 2,
      unknownTimestampMatchCountInRecent20: 0,
      newestMatchTimestampMsInRecent20: 1_762_000_000_000,
      oldestMatchTimestampMsInRecent20: 1_762_000_000_000,
      excludedBeyondRecent20Count: 0,
      positionalMatchCountInRecent20: 2,
      excludedNonPositionalMatchesInRecent20: 0,
    });
    expect(ctx.roleSelection.detectedPrimaryRole).toBe("mid");
    expect(ctx.roleSelection.selectedRole).toBe("mid");
    expect(ctx.roleSelection.isRolePreselectedByDefault).toBe(true);
    expect(ctx.proPlayerSelection.selectedProPlayerId).toBe("ALL");
    expect(ctx.proPlayerSelection.proReferenceAvailableAfterFilters).toBe(true);
    expect(ctx.proPlayerSelection.selectableProPlayersForRole).toHaveLength(5);

    // Verify per-match challenge nullability and whole-game damage share
    const entry1 = ctx.matches.find((m) => m.matchId === "EUW1_555001")!;
    const entry2 = ctx.matches.find((m) => m.matchId === "EUW1_555002")!;
    expect(entry1.playerOwnChallenges.soloKills).toBe(2);
    expect(entry1.playerOwnChallenges.turretPlatesTaken).toBe(3);
    expect(entry1.playerOwnChallenges.opponentTurretPlatesTaken).toBe(1);
    expect(entry1.playerOwnChallenges.proReference).toBeNull();

    expect(entry2.playerOwnChallenges.soloKills).toBeNull();
    expect(entry2.playerOwnChallenges.soloKillsStatus).toBe(
      "unknown_missing_challenge",
    );
    expect(entry2.playerOwnChallenges.turretPlatesTaken).toBeNull();
    expect(entry2.playerOwnChallenges.turretPlatesTakenStatus).toBe(
      "unknown_missing_challenge",
    );
    expect(entry2.playerOwnChallenges.opponentTurretPlatesTaken).toBeNull();

    // Verify per-match deathAttribution: entry1 has 1 death at 250_000ms with [7] (1 assisted death, 0 zero-assist deaths); entry2 has 0 timeline deaths
    expect(entry1.playerDeathAttribution.timelineAssistStatus).toBe("available");
    expect(entry1.playerDeathAttribution.totalTimelineDeaths).toBe(1);
    expect(entry1.playerDeathAttribution.unknownAssistDeathsCount).toBe(0);
    expect(entry1.playerDeathAttribution.knownAssistedDeaths).toBe(1);
    expect(entry1.playerDeathAttribution.zeroAssistDeathsNotProvenSolo).toBe(0);

    expect(entry2.playerDeathAttribution.timelineAssistStatus).toBe("available");
    expect(entry2.playerDeathAttribution.totalTimelineDeaths).toBe(0);
    expect(entry2.playerDeathAttribution.zeroAssistDeathsNotProvenSolo).toBe(0);
    expect(entry2.playerDeathAttribution.knownAssistedDeaths).toBe(0);
    expect(
      entry2.playerDeathAttribution.zeroAssistDeathShareNotProvenSolo,
    ).toBeNull();

    // Verify per-match team damage share (30000 / 100000 = 0.3) and KP (14 / 20 = 0.7)
    expect(entry1.playerWholeGame.championDamageShareStatus).toBe("available");
    expect(entry1.playerWholeGame.championDamageShare).toBe(0.3);
    expect(entry1.playerWholeGame.killParticipationStatus).toBe("available");
    expect(entry1.playerWholeGame.killParticipation).toBe(0.7);

    // Verify per-match full 5m..25m gold & level curves on entry1
    expect(entry1.playerCheckpointCurves[5].totalGold).toBe(1850);
    expect(entry1.playerCheckpointCurves[5].level).toBe(5);
    expect(entry1.playerCheckpointCurves[10].totalGold).toBe(3800);
    expect(entry1.playerCheckpointCurves[10].level).toBe(9);
    expect(entry1.playerCheckpointCurves[15].totalGold).toBe(5900);
    expect(entry1.playerCheckpointCurves[15].level).toBe(11);
    expect(entry1.playerCheckpointCurves[20].totalGold).toBe(8120);
    expect(entry1.playerCheckpointCurves[20].level).toBe(13);
    expect(entry1.playerCheckpointCurves[25].totalGold).toBe(10740);
    expect(entry1.playerCheckpointCurves[25].level).toBe(15);

    // Verify champion+role slice for Syndra + mid
    expect(ctx.championRoleComparisons).toHaveLength(1);
    const syndraSlice = ctx.championRoleComparisons[0];
    expect(syndraSlice.scope.championId).toBe("Syndra");
    expect(syndraSlice.scope.role).toBe("mid");
    expect(syndraSlice.scope.playerPatches).toEqual(["16.20"]);
    expect(syndraSlice.scope.proPatch).toBe("16.20");
    expect(syndraSlice.scope.isCrossPatchComparison).toBe(false);
    expect(syndraSlice.scope.proPlayerFilter.selectedProPlayerId).toBe("ALL");
    expect(
      syndraSlice.scope.proPlayerFilter.selectableProPlayersForSlice.map(
        (p) =>
          `${p.summonerName} (${p.matchingGamesAfterRoleAndChampionFilter}G)`,
      ),
    ).toEqual(["HLE Zeka (2G)", "IG Rookie (1G)"]);
    expect(syndraSlice.scope.timeWindows).toEqual({
      checkpointMinutes: [5, 10, 15, 20, 25, 30],
      checkpointLabels: ["5m", "10m", "15m", "20m", "25m", "30m"],
      wholeGameWindow: "whole_game",
    });
    expect(syndraSlice.scope.counts.playerTotalGames).toBe(2);
    expect(syndraSlice.scope.counts.playerLoadedTimelineGames).toBe(2);
    expect(syndraSlice.scope.counts.proReferenceAvailable).toBe(true);
    expect(syndraSlice.scope.counts.proTotalGames).toBe(3);
    expect(syndraSlice.scope.counts.proPausedGamesInSlice).toBe(1);

    // Slice death attribution: 2 complete games (entry1 + entry2) with 0 zero-assist deaths
    expect(
      syndraSlice.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .eligibleCompleteTimelineGames,
    ).toBe(2);
    expect(
      syndraSlice.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .excludedIncompleteAssistGames,
    ).toBe(0);
    expect(
      syndraSlice.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .zeroAssistDeathsPerGameNotProvenSolo,
    ).toBe(0);
    expect(
      syndraSlice.playerDeathAttribution.zeroAssistDeathsNotProvenSolo
        .proReference,
    ).toBeNull();

    // Verify 10m checkpoint comparison labels player vs proReference with reached/total/paused counts
    const cp10 = syndraSlice.checkpointComparisons[10];
    expect(cp10.totalGold.window).toBe("10m");
    expect(cp10.totalGold.player.mean).toBe(3800);
    expect(cp10.totalGold.player.gamesReached).toBe(2);
    expect(cp10.totalGold.player.totalGames).toBe(2);
    expect(cp10.totalGold.proReference.mean).toBe(3660.7);
    expect(cp10.totalGold.proReference.gamesReached).toBe(3);
    expect(cp10.totalGold.proReference.totalGames).toBe(3);
    expect(cp10.totalGold.deltaPlayerMinusPro).toBe(139.3);

    expect(cp10.level.player.mean).toBe(9.0);
    expect(cp10.level.proReference.mean).toBe(8.3);
    expect(cp10.level.deltaPlayerMinusPro).toBe(0.7);

    expect(cp10.csDiffVsRoleOpponent.player.mean).toBe(8.0);
    expect(cp10.csDiffVsRoleOpponent.proReference.mean).toBe(-0.3);
    expect(cp10.csDiffVsRoleOpponent.deltaPlayerMinusPro).toBe(8.3);

    expect(cp10.goldDiffVsRoleOpponent.player.mean).toBe(300.0);
    expect(cp10.goldDiffVsRoleOpponent.proReference.mean).toBe(-189.7);
    expect(cp10.goldDiffVsRoleOpponent.deltaPlayerMinusPro).toBe(489.7);

    // Early total deaths at 10m excludes the paused pro game (2 reached unpaused, 1 paused excluded)
    expect(cp10.earlyTotalDeaths.player.mean).toBe(0.5);
    expect(cp10.earlyTotalDeaths.player.gamesReached).toBe(2);
    expect(cp10.earlyTotalDeaths.proReference.mean).toBe(0);
    expect(cp10.earlyTotalDeaths.proReference.gamesReached).toBe(2);
    expect(cp10.earlyTotalDeaths.proReference.totalGames).toBe(3);
    expect(cp10.earlyTotalDeaths.proReference.pausedGamesExcluded).toBe(1);
    expect(cp10.earlyTotalDeaths.deltaPlayerMinusPro).toBe(0.5);

    // Whole-game damage share & KP comparison vs pro reference
    const wgDmg = syndraSlice.wholeGameComparisons.championDamageShare;
    expect(wgDmg.window).toBe("whole_game");
    expect(wgDmg.unit).toBe("ratio_0_to_1");
    expect(wgDmg.player.mean).toBe(0.3);
    expect(wgDmg.player.availableGames).toBe(2);
    expect(wgDmg.proReference.mean).toBe(0.2212);
    expect(wgDmg.proReference.availableGames).toBe(3);
    expect(wgDmg.deltaPlayerMinusPro).toBe(0.0788);

    // Player-only challenges summary: match1 had soloKills=2, turretPlatesTaken=3; match2 had missing challenges.
    // Mean must be 2 and 3 (over 1 available game, with 1 missingUnknownGame), NEVER diluted to 1 and 1.5!
    expect(syndraSlice.playerOnlyChallengesSummary.soloKills).toMatchObject({
      playerMean: 2,
      playerAvailableGames: 1,
      playerMissingUnknownGames: 1,
      playerTotalGames: 2,
      proReference: null,
      deltaPlayerMinusPro: null,
      comparisonStatus: "PLAYER_ONLY_NO_PRO_REFERENCE",
    });
    expect(
      syndraSlice.playerOnlyChallengesSummary.turretPlatesTaken,
    ).toMatchObject({
      playerMean: 3,
      playerAvailableGames: 1,
      playerMissingUnknownGames: 1,
      playerTotalGames: 2,
      proReference: null,
      deltaPlayerMinusPro: null,
      comparisonStatus: "PLAYER_ONLY_NO_PRO_REFERENCE",
    });

    // Unsupported pro comparison metrics explicitly labeled
    expect(
      syndraSlice.unsupportedProComparisonMetrics.soloKills,
    ).toMatchObject({
      metricKey: "soloKills",
      status: "UNSUPPORTED_FOR_PRO_COMPARISON",
      playerVsProComparable: false,
      playerOwnChallengeValueAvailableInSlice: true,
      proReference: null,
      deltaPlayerMinusPro: null,
    });
    expect(
      syndraSlice.unsupportedProComparisonMetrics.soloDeaths,
    ).toMatchObject({
      metricKey: "soloDeaths",
      status: "UNSUPPORTED_FOR_PRO_COMPARISON",
      playerVsProComparable: false,
      playerOwnChallengeValueAvailableInSlice: false,
      proReference: null,
      deltaPlayerMinusPro: null,
    });
    expect(
      syndraSlice.unsupportedProComparisonMetrics.turretPlates,
    ).toMatchObject({
      metricKey: "turretPlates",
      status: "UNSUPPORTED_FOR_PRO_COMPARISON",
      playerVsProComparable: false,
      playerOwnChallengeValueAvailableInSlice: true,
      proReference: null,
      deltaPlayerMinusPro: null,
    });
  });

  it("supports narrowing coach context to a specific pro player (e.g. Zeka) and marks Chovy/Faker or 0-game slices as unavailable without fabricating data", () => {
    const profile = SYNTHETIC_TEST_PROFILES.kr_mid_specialist;

    // 1. Narrow to HLE Zeka by stable esportsPlayerId -> 2 matching pro games on Mid · Syndra
    const zekaCtx = buildCoachProComparisonContext({
      puuid: profile.puuid,
      region: profile.region,
      gameName: profile.gameName,
      tagLine: profile.tagLine,
      matches: profile.visibleMatches,
      timelinesByMatchId: profile.timelinesByMatchId,
      selectedProPlayerId: "103478281361900912",
    });
    expect(zekaCtx.proPlayerSelection.selectedProPlayerId).toBe(
      "103478281361900912",
    );
    expect(zekaCtx.proPlayerSelection.isProPlayerFoundInDataset).toBe(true);
    expect(zekaCtx.proPlayerSelection.resolvedProPlayer?.playerHandle).toBe(
      "Zeka",
    );
    const zekaSyndra = zekaCtx.championRoleComparisons[0];
    expect(zekaSyndra.scope.counts.proReferenceAvailable).toBe(true);
    expect(zekaSyndra.scope.counts.proTotalGames).toBe(2);
    expect(zekaSyndra.scope.counts.proPausedGamesInSlice).toBe(0);
    expect(
      zekaSyndra.checkpointComparisons[10].totalCs.proReference.mean,
    ).toBe(98.0);

    // 2. Narrow to vision example 'Chovy' or 'Faker' -> not in dataset, proReferenceAvailable: false, proTotalGames: 0
    for (const missingPro of ["Chovy", "Faker"]) {
      const missingCtx = buildCoachProComparisonContext({
        puuid: profile.puuid,
        region: profile.region,
        gameName: profile.gameName,
        tagLine: profile.tagLine,
        matches: profile.visibleMatches,
        timelinesByMatchId: profile.timelinesByMatchId,
        selectedProPlayerId: missingPro,
      });
      expect(missingCtx.proPlayerSelection.selectedProPlayerId).toBe(
        missingPro,
      );
      expect(missingCtx.proPlayerSelection.isProPlayerFoundInDataset).toBe(
        false,
      );
      expect(missingCtx.proPlayerSelection.resolvedProPlayer).toBeNull();
      expect(missingCtx.proPlayerSelection.matchingProGamesAfterFilters).toBe(
        0,
      );
      const slice = missingCtx.championRoleComparisons[0];
      expect(slice.scope.counts.proReferenceAvailable).toBe(false);
      expect(slice.scope.counts.proTotalGames).toBe(0);
      expect(slice.scope.proPlayerFilter.isProPlayerFoundInDataset).toBe(false);
      expect(
        slice.checkpointComparisons[10].totalCs.proReference.status,
      ).toBe("unsupported_pair");
      expect(
        slice.checkpointComparisons[10].totalCs.proReference.mean,
      ).toBeNull();
      expect(
        slice.checkpointComparisons[10].totalCs.deltaPlayerMinusPro,
      ).toBeNull();
    }
  });

  it("sorts 25 shuffled + duplicate matches by validated timestamp newest-first in coach context and strictly scopes matches/championRoleComparisons to the preselected or selected role while exposing separate allRolesInRecent20Metadata", () => {
    const puuid = "puuid-coach-recent20-role-scope";
    const baseTimestampMs = 1_762_500_000_000;

    // 25 unique matches:
    // - Chronological rank 1..15 (newest timestamps): Mid Syndra
    // - Chronological rank 16..20 (next 5 newest timestamps): Top KSante
    // - Chronological rank 21..23 (older timestamps beyond recent 20): Bot Ezreal
    // - Chronological rank 24..25 (unknown/invalid timestamps): Bot Ezreal
    const chronologicalNewestFirst: MatchDto[] = Array.from(
      { length: 25 },
      (_, idx) => {
        const rank = idx + 1;
        const isMid = rank <= 15;
        const isTop = rank >= 16 && rank <= 20;
        const championName = isMid ? "Syndra" : isTop ? "KSante" : "Ezreal";
        const teamPosition = isMid ? "MIDDLE" : isTop ? "TOP" : "BOTTOM";
        const tsMs = baseTimestampMs + (30 - rank) * 3_600_000;

        const timestampFields =
          rank <= 20
            ? { gameEndTimestamp: tsMs }
            : rank <= 23
              ? { gameCreation: tsMs }
              : rank === 24
                ? {}
                : { gameEndTimestamp: -1, gameCreation: 0 };

        return {
          metadata: {
            matchId: `EUW1_COACH_${String(rank).padStart(3, "0")}`,
            participants: [puuid],
          },
          info: {
            gameId: 9000 + rank,
            ...timestampFields,
            gameDuration: 1800,
            gameMode: "CLASSIC",
            gameVersion: "16.20.826.3891",
            queueId: 420,
            participants: [
              {
                participantId: 1,
                puuid,
                championName,
                teamPosition,
                teamId: 100,
                win: rank % 2 === 1,
                kills: 6,
                deaths: 2,
                assists: 8,
                totalMinionsKilled: 220,
                neutralMinionsKilled: 10,
                challenges: {
                  soloKills: 1,
                  turretPlatesTaken: 2,
                },
              },
            ],
          },
        };
      },
    );

    // Shuffle and place the 5 older/unknown-date Bot Ezreal matches FIRST, plus 2 duplicates
    const shuffledWithDuplicates: MatchDto[] = [
      chronologicalNewestFirst[24], // rank 25 (Ezreal Bot, invalid timestamp -> unknown)
      chronologicalNewestFirst[23], // rank 24 (Ezreal Bot, missing timestamp -> unknown)
      chronologicalNewestFirst[22], // rank 23 (Ezreal Bot, old timestamp)
      chronologicalNewestFirst[21], // rank 22 (Ezreal Bot, old timestamp)
      chronologicalNewestFirst[20], // rank 21 (Ezreal Bot, old timestamp)
      chronologicalNewestFirst[19], // rank 20 (KSante Top)
      chronologicalNewestFirst[18], // rank 19 (KSante Top)
      chronologicalNewestFirst[19], // duplicate of rank 20
      chronologicalNewestFirst[17], // rank 18 (KSante Top)
      chronologicalNewestFirst[16], // rank 17 (KSante Top)
      chronologicalNewestFirst[15], // rank 16 (KSante Top)
      chronologicalNewestFirst[14], // rank 15 (Syndra Mid)
      chronologicalNewestFirst[13], // rank 14 (Syndra Mid)
      chronologicalNewestFirst[12], // rank 13 (Syndra Mid)
      chronologicalNewestFirst[11], // rank 12 (Syndra Mid)
      chronologicalNewestFirst[10], // rank 11 (Syndra Mid)
      chronologicalNewestFirst[9], // rank 10 (Syndra Mid)
      chronologicalNewestFirst[8], // rank 9 (Syndra Mid)
      chronologicalNewestFirst[7], // rank 8 (Syndra Mid)
      chronologicalNewestFirst[6], // rank 7 (Syndra Mid)
      chronologicalNewestFirst[5], // rank 6 (Syndra Mid)
      chronologicalNewestFirst[4], // rank 5 (Syndra Mid)
      chronologicalNewestFirst[3], // rank 4 (Syndra Mid)
      chronologicalNewestFirst[2], // rank 3 (Syndra Mid)
      chronologicalNewestFirst[1], // rank 2 (Syndra Mid)
      chronologicalNewestFirst[0], // rank 1 (Syndra Mid)
      chronologicalNewestFirst[0], // duplicate of rank 1
    ];

    // 1. Default invocation (selectedRole omitted -> preselected to 'mid'):
    //    Coach context MUST scope matches and championRoleComparisons strictly to 'mid' (15 games),
    //    and MUST NOT emit 'top::KSante' in championRoleComparisons or matches!
    const defaultCtx = buildCoachProComparisonContext({
      puuid,
      region: "EUW1",
      gameName: "CoachWindowTester",
      tagLine: "EUW",
      matches: shuffledWithDuplicates,
    });

    expect(defaultCtx.recentMatchWindow).toEqual({
      maxRecentMatches: 20,
      timestampSortPolicy:
        "known_timestamps_newest_first_then_unknown_in_input_order",
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

    expect(defaultCtx.roleSelection.detectedPrimaryRole).toBe("mid");
    expect(defaultCtx.roleSelection.selectedRole).toBe("mid");
    expect(defaultCtx.roleSelection.isRolePreselectedByDefault).toBe(true);
    expect(defaultCtx.roleSelection.playerGamesInSelectedRole).toBe(15);

    // Coach matches and championRoleComparisons are strictly scoped to the preselected 'mid' role
    expect(defaultCtx.championRoleComparisons.map((c) => c.pairKey)).toEqual([
      "mid::Syndra",
    ]);
    expect(defaultCtx.matches).toHaveLength(15);
    expect(defaultCtx.matches.every((m) => m.role === "mid")).toBe(true);
    expect(defaultCtx.matches.map((m) => m.matchId)).toEqual(
      Array.from(
        { length: 15 },
        (_, idx) => `EUW1_COACH_${String(idx + 1).padStart(3, "0")}`,
      ),
    );

    // Separate allRolesInRecent20Metadata explicitly exposes off-role Top · KSante with isIncludedInSelectedRoleScope=false
    expect(defaultCtx.allRolesInRecent20Metadata).toMatchObject({
      selectedRoleScope: "mid",
      isRolePreselectedByDefault: true,
      totalPositionalMatchesInRecent20: 20,
      playerGamesInSelectedRoleScope: 15,
      playerGamesOutsideSelectedRoleScope: 5,
      rolesPresentInRecent20: ["mid", "top"],
      allPairsInRecent20: [
        {
          pairKey: "mid::Syndra",
          championId: "Syndra",
          role: "mid",
          playerGameCount: 15,
          isIncludedInSelectedRoleScope: true,
        },
        {
          pairKey: "top::KSante",
          championId: "KSante",
          role: "top",
          playerGameCount: 5,
          isIncludedInSelectedRoleScope: false,
        },
      ],
    });

    // 2. Switching selectedRole to 'top' scopes coach matches (5G) and championRoleComparisons to 'top::KSante'
    const topCtx = buildCoachProComparisonContext({
      puuid,
      region: "EUW1",
      gameName: "CoachWindowTester",
      tagLine: "EUW",
      matches: shuffledWithDuplicates,
      selectedRole: "top",
    });
    expect(topCtx.roleSelection.selectedRole).toBe("top");
    expect(topCtx.roleSelection.isRolePreselectedByDefault).toBe(false);
    expect(topCtx.championRoleComparisons.map((c) => c.pairKey)).toEqual([
      "top::KSante",
    ]);
    expect(topCtx.matches).toHaveLength(5);
    expect(topCtx.matches.map((m) => m.matchId)).toEqual([
      "EUW1_COACH_016",
      "EUW1_COACH_017",
      "EUW1_COACH_018",
      "EUW1_COACH_019",
      "EUW1_COACH_020",
    ]);
    expect(topCtx.allRolesInRecent20Metadata.playerGamesInSelectedRoleScope).toBe(
      5,
    );
    expect(
      topCtx.allRolesInRecent20Metadata.playerGamesOutsideSelectedRoleScope,
    ).toBe(15);

    // 3. Explicitly passing selectedRole: 'ALL' includes both 'mid::Syndra' and 'top::KSante' (20G)
    const allRolesCtx = buildCoachProComparisonContext({
      puuid,
      region: "EUW1",
      gameName: "CoachWindowTester",
      tagLine: "EUW",
      matches: shuffledWithDuplicates,
      selectedRole: "ALL",
    });
    expect(allRolesCtx.roleSelection.selectedRole).toBe("ALL");
    expect(allRolesCtx.roleSelection.isRolePreselectedByDefault).toBe(false);
    expect(allRolesCtx.championRoleComparisons.map((c) => c.pairKey)).toEqual([
      "mid::Syndra",
      "top::KSante",
    ]);
    expect(allRolesCtx.matches).toHaveLength(20);
  });
});

