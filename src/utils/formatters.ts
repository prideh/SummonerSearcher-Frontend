const STAT_NAME_MAPPING: Record<string, string> = {
  abilityUses: 'Abilities used',
  acesBefore15Minutes: 'Aces before 15 min',
  baronTakedowns: 'Baron nashor takedowns',
  blastConeOppositeOpponentCount: 'Blast cone hits on opponent',
  controlWardsPlaced: 'Control wards placed',
  damagePerMinute: 'Damage per minute (dpm)',
  deathsByEnemyChamps: 'Deaths to champions',
  dodgeSkillShotsSmallWindow: 'Quick reaction dodges',
  doubleKills: 'Double kills',
  dragonTakedowns: 'Dragon takedowns',
  earlyLaningPhaseGoldExpAdvantage: 'Early gold/xp lead',
  effectiveHealAndShielding: 'Effective healing & shielding',
  elderDragonMultikills: 'Multikills w/ elder dragon',
  enemyChampionImmobilizations: 'Enemies immobilized',
  enemyJungleMonsterKills: 'Enemy jungle camps',
  epicMonsterKillsNearEnemyJungler: 'Objectives taken near enemy jungler',
  epicMonsterKillsWithin30SecondsOfSpawn: 'Objectives taken on spawn (<30s)',
  epicMonsterSteals: 'Objectives stolen',
  epicMonsterStolenWithoutSmite: 'Objectives stolen (no smite)',
  firstTurretKilled: 'First turret destroyed',
  firstTurretKilledTime: 'First turret time',
  flawlessAces: 'Flawless aces',
  fullTeamTakedown: 'Full team takedown',
  gameLength: 'Game length',
  getTakedownsInAllLanesEarlyJungleAsLaner: 'Early roaming takedowns (laner)',
  goldPerMinute: 'Gold per minute (gpm)',
  hadOpenNexus: 'Nexus exposed',
  highestChampionDamage: 'Highest champion damage',
  highestCrowdControlScore: 'Highest cc score',
  immobilizeAndKillWithAlly: 'Immobilize & kill w/ ally',
  initialBuffCount: 'Initial buffs taken',
  initialCrabCount: 'Initial scuttles taken',
  jungleCsBefore10Minutes: 'Jungle cs @ 10 min',
  junglerKillsEarlyJungle: 'Early jungle kills',
  kda: 'Kda',
  killParticipation: 'Kill participation (kp%)',
  killsOnLanersEarlyJungleAsJungler: 'Early ganks (jungler)',
  killsOnRecentlyHealedByAramPack: 'Kills on aram healed enemies',
  killsUnderOwnTurret: 'Kills under own turret',
  killsWithHelpFromEpicMonster: 'Kills w/ objectives help',
  landSkillShotsEarlyGame: 'Skillshots landed (early)',
  laneMinionsFirst10Minutes: 'Lane minions @ 10 min',
  laningPhaseGoldExpAdvantage: 'Laning gold/xp lead',
  legendaryCount: 'Legendary streaks',
  lostAnInhibitor: 'Inhibitor lost',
  maxCsAdvantageOnLaneOpponent: 'Max cs lead vs opponent',
  maxKillDeficit: 'Max kill deficit',
  maxLevelLeadLaneOpponent: 'Max level lead vs opponent',
  moreEnemyJungleThanOpponent: 'Jungle counter-jungle gap',
  multiKillOneSpell: 'Multikill (one spell)',
  multiTurretRiftHeraldCount: 'Turrets taken w/ herald',
  multikills: 'Multikills',
  multikillsAfterAggressiveFlash: 'Flash multikills',
  outerTurretExecutesBefore10Minutes: 'Outer turret executed (<10 min)',
  outnumberedKills: 'Outnumbered kills',
  outnumberedNexusKill: 'Outnumbered nexus kill',
  perfectDragonSoulsTaken: 'Perfect dragon souls',
  perfectGame: 'Perfect game',
  pickKillWithAlly: 'Pick kill w/ ally',
  playedChampSelectPosition: 'Played assigned role',
  poroExplosions: 'Poro explosions (aram)',
  quickCleanse: 'Quick cleanse/qss usage',
  quickFirstTurret: 'Quick first turret',
  quickSoloKills: 'Quick solo kills',
  riftHeraldTakedowns: 'Rift herald takedowns',
  saveAllyFromDeath: 'Ally saved from death',
  scuttleCrabKills: 'Scuttle crabs killed',
  skillshotsDodged: 'Skillshots dodged',
  skillshotsHit: 'Skillshots hit',
  soloBaronKills: 'Solo baron kills',
  soloKills: 'Solo kills',
  soloTurretsLategame: 'Solo turrets (late game)',
  stealthWardsPlaced: 'Stealth wards placed',
  survivedSingleDigitHpCount: 'Survived w/ single digit hp',
  survivedThreeImmobilizesInFight: 'Survived 3+ immobilizations',
  takedownOnFirstTurret: 'First turret assist',
  takedowns: 'Takedowns',
  takedownsAfterGainingLevelAdvantage: 'Takedowns w/ level lead',
  takedownsBeforeJungleMinionSpawn: 'Invade takedowns (pre-spawn)',
  takedownsFirst25Minutes: 'Takedowns @ 25 min',
  takedownsInEnemyFountain: 'Fountain dives',
  takedownsInAlcove: 'Alcove takedowns',
  teamBaronKills: 'Team baron kills',
  teamDamagePercentage: 'Team damage share (%)',
  teamElderDragonKills: 'Team elder dragon kills',
  teamRiftHeraldKills: 'Team rift herald kills',
  teleportTakedowns: 'Teleport takedowns',
  threeWardsOneSweeperCount: '3 wards cleared (1 sweep)',
  tookLargeDamageSurvived: 'Heavy damage survived',
  turretPlatesTaken: 'Turret plates taken',
  turretTakedowns: 'Turret takedowns',
  turretsTakenWithRiftHerald: 'Turrets taken w/ herald',
  twentyMinionsIn3SecondsCount: '20 minions in 3 seconds',
  unseenRecalls: 'Unseen recalls',
  visionScore: 'Vision score',
  visionScoreAdvantageLaneOpponent: 'Vision score lead vs opponent',
  visionScorePerMinute: 'Vision score per minute',
  wardTakedowns: 'Wards destroyed',
  wardTakedownsBefore20M: 'Wards destroyed @ 20 min',
  wardsGuarded: 'Wards guarded',
};

export const camelCaseToTitleCase = (text: string) => {
  if (STAT_NAME_MAPPING[text]) {
    return STAT_NAME_MAPPING[text];
  }
  const result = text.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
};

export const isTimeChallenge = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    (lowerKey.startsWith('earliest') ||
    lowerKey.startsWith('fastest') ||
    lowerKey.startsWith('shortest') ||
    (lowerKey.includes('time') && !lowerKey.includes('times') && !lowerKey.includes('perminute') && !lowerKey.includes('intime'))) &&
    lowerKey !== 'controlwardtimecoverageinriverorenemyhalf'
  );
};

export const formatPercentage = (value: number) => {
  return `${(value * 100).toFixed(1)}%`;
};

export const isPercentageChallenge = (key: string) => {
  const lowerKey = key.toLowerCase();
  return (
    lowerKey.includes('percent') ||
    lowerKey.includes('pct') ||
    lowerKey.includes('participation') ||
    lowerKey === 'controlwardtimecoverageinriverorenemyhalf' ||
    lowerKey === 'visionscoreadvantagelaneopponent'
  );
};

export const formatNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
};
