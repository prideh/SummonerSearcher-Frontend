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
  InfernalScalePickup?: number;
  voidMonsterKill?: number;
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
  dragonTakedowns?: number;
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
  soloKills?: number;
}

export interface ParticipantDto {
  assists?: number;
  champLevel?: number;
  championId?: number;
  championName?: string;
  damageDealtToBuildings?: number;
  damageDealtToObjectives?: number;
  damageDealtToTurrets?: number;
  damageSelfMitigated?: number;
  deaths?: number;
  detectorWardsPlaced?: number;
  doubleKills?: number;
  dragonKills?: number;
  firstBloodAssist?: boolean;
  firstBloodKill?: boolean;
  firstTowerAssist?: boolean;
  firstTowerKill?: boolean;
  goldEarned?: number;
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
  tripleKills?: number;
  trueDamageDealtToChampions?: number;
  trueDamageTaken?: number;
  turretKills?: number;
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

export interface MatchInfo {
  gameCreation?: number;
  gameDuration?: number;
  gameMode?: string;
  queueId?: number;
  participants: ParticipantDto[];
}

export interface MatchDto {
  info?: MatchInfo;
}