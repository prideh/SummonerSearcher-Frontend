export interface ChallengesDto {
  controlWardTimeCoverageInRiverOrEnemyHalf?: number;
  earliestBaron?: number;
  earliestDragonTakedown?: number;
  earlyLaningPhaseGoldExpAdvantage?: number;
  fasterSupportQuestCompletion?: number;
  highestChampionDamage?: number;
  highestCrowdControlScore?: number;
  junglerKillsEarlyJungle?: number;
  killsOnLanersEarlyJungleAsJungler?: number;
  laningPhaseGoldExpAdvantage?: number;
  legendaryCount?: number;
  maxCsAdvantageOnLaneOpponent?: number;
  maxLevelLeadLaneOpponent?: number;
  mostWardsDestroyedOneSweeper?: number;
  playedChampSelectPosition?: number;
  soloTurretsLategame?: number;
  takedownsFirst25Minutes?: number;
  teleportTakedowns?: number;
  threeWardsOneSweeperCount?: number;
  visionScoreAdvantageLaneOpponent?: number;
  turretPlatesTaken?: number;
  turretTakedowns?: number | null;
  baronTakedowns?: number | null;
  riftHeraldTakedowns?: number | null;
  InfernalScalePickup?: number;
  voidMonsterKill?: number | null;
  abilityUses?: number;
  acesBefore15Minutes?: number;
  alliedJungleMonsterKills?: number;
  bountyGold?: number;
  buffsStolen?: number;
  completeSupportQuestInTime?: number;
  controlWardsPlaced?: number;
  damagePerMinute?: number;
  damageTakenOnTeamPercentage?: number;
  dodgeSkillShotsSmallWindow?: number;
  dragonTakedowns?: number | null;
  legendaryItemUsed?: number[];
  effectiveHealAndShielding?: number;
  enemyChampionImmobilizations?: number;
  enemyJungleMonsterKills?: number;
  epicMonsterKillsNearEnemyJungler?: number;
  epicMonsterKillsWithin30SecondsOfSpawn?: number;
  epicMonsterSteals?: number;
  epicMonsterStolenWithoutSmite?: number;
  firstTurretKilled?: number;
  firstTurretKilledTime?: number;
  flawlessAces?: number;
  fullTeamTakedown?: number;
  getTakedownsInAllLanesEarlyJungleAsLaner?: number;
  jungleCsBefore10Minutes?: number;
  laneMinionsFirst10Minutes?: number;
  soloKills?: number;
}

export interface ParticipantDto {
  assists?: number;
  baronKills?: number | null;
  bountyLevel?: number;
  champLevel?: number;
  championId?: number;
  championName?: string;
  damageDealtToBuildings?: number;
  damageDealtToObjectives?: number;
  damageDealtToTurrets?: number;
  damageSelfMitigated?: number;
  deaths?: number | null;
  detectorWardsPlaced?: number;
  doubleKills?: number;
  dragonKills?: number | null;
  firstBloodAssist?: boolean;
  firstBloodKill?: boolean;
  firstTowerAssist?: boolean;
  firstTowerKill?: boolean;
  goldEarned?: number;
  goldSpent?: number;
  individualPosition?: string;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  kills?: number;
  lane?: string;
  largestKillingSpree?: number;
  largestMultiKill?: number;
  magicDamageDealtToChampions?: number;
  magicDamageTaken?: number;
  neutralMinionsKilled?: number;
  objectivesStolen?: number;
  objectivesStolenAssists?: number;
  participantId?: number;
  pentaKills?: number;
  physicalDamageDealtToChampions?: number;
  physicalDamageTaken?: number;
  profileIcon?: number;
  puuid?: string;
  quadraKills?: number;
  riotIdGameName?: string;
  riotIdTagline?: string;
  sightWardsBoughtInGame?: number;
  spell1Casts?: number;
  spell2Casts?: number;
  spell3Casts?: number;
  spell4Casts?: number;
  summoner1Casts?: number;
  summoner1Id?: number;
  summoner2Casts?: number;
  summoner2Id?: number;
  summonerId?: string;
  summonerLevel?: number;
  summonerName?: string;
  teamId?: number;
  teamPosition?: string;
  timeCCingOthers?: number;
  timePlayed?: number;
  totalDamageDealtToChampions?: number;
  totalDamageShieldedOnTeammates?: number;
  totalDamageTaken?: number;
  totalHeal?: number;
  totalAllyJungleMinionsKilled?: string;
  totalHealsOnTeammates?: number;
  totalMinionsKilled?: number;
  totalTimeCCDealt?: number;
  totalTimeSpentDead?: number | null;
  tripleKills?: number;
  trueDamageDealtToChampions?: number;
  trueDamageTaken?: number;
  turretKills?: number | null;
  turretTakedowns?: number | null;
  visionScore?: number;
  visionWardsBoughtInGame?: number;
  wardsKilled?: number;
  wardsPlaced?: number;
  win?: boolean;
  challenges?: ChallengesDto;
  perks?: PerksDto;
  gameEndedInEarlySurrender?: boolean;
}

export interface PerksDto {
  statPerks: PerkStatsDto;
  styles: PerkStyleDto[];
}

export interface PerkStatsDto {
  defense: number;
  flex: number;
  offense: number;
}

export interface PerkStyleDto {
  description: 'primaryStyle' | 'subStyle';
  selections: PerkStyleSelectionDto[];
  style: number; // Rune path ID
}

export interface PerkStyleSelectionDto {
  perk: number; // Rune ID
}

export interface ObjectiveStatsDto {
  first?: boolean | null;
  kills?: number | null;
}

export interface TeamObjectivesDto {
  baron?: ObjectiveStatsDto | null;
  champion?: ObjectiveStatsDto | null;
  dragon?: ObjectiveStatsDto | null;
  horde?: ObjectiveStatsDto | null;
  grubs?: ObjectiveStatsDto | null;
  inhibitor?: ObjectiveStatsDto | null;
  riftHerald?: ObjectiveStatsDto | null;
  herald?: ObjectiveStatsDto | null;
  tower?: ObjectiveStatsDto | null;
}

export interface TeamBanDto {
  championId?: number | null;
  pickTurn?: number | null;
}

export interface TeamDto {
  teamId?: number | null;
  win?: boolean | null;
  bans?: TeamBanDto[] | null;
  objectives?: TeamObjectivesDto | null;
}

export interface MatchInfo {
  gameId: number;
  gameCreation?: number;
  gameEndTimestamp?: number;
  gameDuration?: number;
  gameMode?: string;
  gameVersion?: string;
  queueId?: number;
  participants: ParticipantDto[];
  teams?: TeamDto[] | null;
}

export interface MatchDto {
  metadata?: {
    matchId?: string;
    participants?: string[];
  };
  info?: MatchInfo;
}