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
      missingChallengesPolicy: "preserve_null_unknown_never_zero",
      missingTimelineAssistsPolicy: "preserve_null_unknown_never_zero_or_solo",
      unassistedKillDeathPolicy:
        "zero_recorded_assists_is_not_proven_1v1_solo",
      proEarlyDeathsPausePolicy:
        "exclude_paused_pro_games_with_total_pause_gt_0",
      recentMatchWindowPolicy: "most_recent_20_deduplicated_matches_only",
      proPlayerFilterPolicy: "never_fabricate_pro_player_availability",
    });

    // Verify recentMatchWindow, roleSelection, and proPlayerSelection on default context
    expect(ctx.recentMatchWindow).toEqual({
      maxRecentMatches: 20,
      inputMatchCount: 2,
      analyzedRecentMatchCount: 2,
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
});

