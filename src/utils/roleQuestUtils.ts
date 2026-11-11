import type { ParticipantDto } from '../types/match';
import type { BuildItem, MatchTimelineDto, SkillUp, TimelineEventDto } from '../types/timeline';

export interface RoleQuestItemMetadata {
  id: number;
  name: string;
  shortLabel: string;
  summary: string;
  kind: 'quest_starter' | 'quest_reward' | 'tier3_boots';
}

/**
 * Verified Patch 26.22 / Data Dragon 16.22.1 Role Quest & Tier 3 Boot metadata.
 * Used as rich fallback when Data Dragon version lags or icons 404 (#1184), and for
 * conservative Role Quest classification without guessing unverified item IDs.
 */
export const VERIFIED_ROLE_QUEST_METADATA: Readonly<Record<number, RoleQuestItemMetadata>> = {
  1200: {
    id: 1200,
    name: 'Top Lane Quest',
    shortLabel: 'Top Lane Quest (In Progress)',
    summary: 'Season 2026 Top Lane Role Quest starter item (in progress).',
    kind: 'quest_starter',
  },
  1201: {
    id: 1201,
    name: 'Mid Lane Quest',
    shortLabel: 'Mid Lane Quest (In Progress)',
    summary: 'Season 2026 Mid Lane Role Quest starter item (in progress).',
    kind: 'quest_starter',
  },
  1202: {
    id: 1202,
    name: 'Bot Lane Quest',
    shortLabel: 'Bot Lane Quest (In Progress)',
    summary: 'Season 2026 Bot Lane Role Quest starter item (in progress).',
    kind: 'quest_starter',
  },
  1203: {
    id: 1203,
    name: 'Support Quest',
    shortLabel: 'Support Quest (In Progress)',
    summary: 'Season 2026 Support Role Quest starter item (in progress).',
    kind: 'quest_starter',
  },
  1204: {
    id: 1204,
    name: 'Jungle Quest',
    shortLabel: 'Jungle Quest (In Progress)',
    summary: 'Season 2026 Jungle Role Quest starter item (in progress).',
    kind: 'quest_starter',
  },
  1222: {
    id: 1222,
    name: 'Top Lane Quest',
    shortLabel: 'Top Lane Quest (In Progress)',
    summary: 'Season 2026 Top Lane Role Quest starter item (in progress).',
    kind: 'quest_starter',
  },
  1205: {
    id: 1205,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest: evolved companion, upgraded Smite, bonus large-monster gold and experience, and bonus Move Speed in the jungle.',
    kind: 'quest_reward',
  },
  1206: {
    id: 1206,
    name: 'Mid Lane Quest Reward',
    shortLabel: 'Mid Quest Complete',
    summary: 'Completed Mid Lane Role Quest: unlocks Tier 3 Boots and grants 8% bonus Attack Damage and Ability Power (Patch 26.22).',
    kind: 'quest_reward',
  },
  1207: {
    id: 1207,
    name: 'Bot Lane Quest Reward',
    shortLabel: 'Bot Quest Complete',
    summary: 'Completed Bot Lane Role Quest: 300 bonus gold on completion, dedicated Boots slot freeing all 6 inventory slots, plus bonus gold on minions and takedowns (Patch 26.22).',
    kind: 'quest_reward',
  },
  1208: {
    id: 1208,
    name: 'Support Quest Reward',
    shortLabel: 'Support Quest Complete',
    summary: 'Completed Support Role Quest: dedicated Control Ward slot, discounted Control Wards, and upgraded passive gold income.',
    kind: 'quest_reward',
  },
  1209: {
    id: 1209,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest: evolved companion, upgraded Smite, bonus large-monster gold and experience, and bonus Move Speed in the jungle.',
    kind: 'quest_reward',
  },
  1210: {
    id: 1210,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest: evolved companion and upgraded Smite.',
    kind: 'quest_reward',
  },
  1211: {
    id: 1211,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest: evolved companion and upgraded Smite.',
    kind: 'quest_reward',
  },
  1220: {
    id: 1220,
    name: 'Unleashed Teleport (Top Lane Quest Reward)',
    shortLabel: 'Top Quest: Unleashed Teleport',
    summary: 'Completed Top Lane Role Quest: level cap raised to 20, bonus experience, and Unleashed Teleport (390-second base cooldown in Patch 26.22).',
    kind: 'quest_reward',
  },
  1221: {
    id: 1221,
    name: 'Top Lane Quest Reward',
    shortLabel: 'Top Quest: Enhanced Teleport',
    summary: 'Completed Top Lane Role Quest: level cap raised to 20, bonus experience, and a max-Health shield on Teleport arrival.',
    kind: 'quest_reward',
  },
  3170: {
    id: 3170,
    name: 'Swiftmarch',
    shortLabel: 'Swiftmarch (Tier 3 Boots)',
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Boots of Swiftness (1,000 gold total).',
    kind: 'tier3_boots',
  },
  3171: {
    id: 3171,
    name: 'Crimson Lucidity',
    shortLabel: 'Crimson Lucidity (Tier 3 Boots)',
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Ionian Boots of Lucidity (900 gold total).',
    kind: 'tier3_boots',
  },
  3172: {
    id: 3172,
    name: 'Gunmetal Greaves',
    shortLabel: 'Gunmetal Greaves (Tier 3 Boots)',
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Berserker\'s Greaves (1,100 gold total).',
    kind: 'tier3_boots',
  },
  3173: {
    id: 3173,
    name: 'Chainlaced Crushers',
    shortLabel: 'Chainlaced Crushers (Tier 3 Boots)',
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Mercury\'s Treads (1,250 gold total).',
    kind: 'tier3_boots',
  },
  3174: {
    id: 3174,
    name: 'Armored Advance',
    shortLabel: 'Armored Advance (Tier 3 Boots)',
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Plated Steelcaps (1,200 gold total).',
    kind: 'tier3_boots',
  },
  3175: {
    id: 3175,
    name: "Spellslinger's Shoes",
    shortLabel: "Spellslinger's Shoes (Tier 3 Boots)",
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Sorcerer\'s Shoes (1,100 gold total).',
    kind: 'tier3_boots',
  },
  3176: {
    id: 3176,
    name: 'Forever Forward',
    shortLabel: 'Forever Forward (Tier 3 Boots)',
    summary: 'Completed Mid Lane Quest Tier 3 upgrade from Synchronized Souls (900 gold total).',
    kind: 'tier3_boots',
  },
};

export const STARTER_ROLE_QUEST_IDS = new Set<number>([1200, 1201, 1202, 1203, 1204, 1222]);
export const COMPLETED_ROLE_QUEST_REWARD_IDS = new Set<number>([
  1205, 1206, 1207, 1208, 1209, 1210, 1211, 1220, 1221,
]);
export const TIER_3_BOOT_IDS = new Set<number>([3170, 3171, 3172, 3173, 3174, 3175, 3176]);
export const VERIFIED_BOOT_ITEM_IDS = new Set<number>([
  1001, 2422,
  3006, 3009, 3010, 3013, 3020, 3047, 3111, 3117, 3158,
  3170, 3171, 3172, 3173, 3174, 3175, 3176,
]);

const ROLE_QUEST_ELIGIBLE_QUEUE_IDS = new Set<number>([400, 420, 440, 700]);

const MONSTER_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  FIRE_DRAGON: 'Infernal Drake',
  WATER_DRAGON: 'Ocean Drake',
  EARTH_DRAGON: 'Mountain Drake',
  AIR_DRAGON: 'Cloud Drake',
  HEXTECH_DRAGON: 'Hextech Drake',
  CHEMTECH_DRAGON: 'Chemtech Drake',
  ELDER_DRAGON: 'Elder Dragon',
  DRAGON: 'Dragon',
  HORDE: 'Void Grubs',
  VOID_GRUB: 'Void Grubs',
  VOID_GRUBS: 'Void Grubs',
  RIFTHERALD: 'Rift Herald',
  RIFT_HERALD: 'Rift Herald',
  BARON_NASHOR: 'Baron Nashor',
  BARON: 'Baron Nashor',
  ATAKHAN: 'Atakhan',
};

const WARD_DISPLAY_LABELS: Readonly<Record<string, string>> = {
  YELLOW_TRINKET: 'Stealth Ward',
  CONTROL_WARD: 'Control Ward',
  BLUE_TRINKET: 'Farsight Ward',
  SIGHT_WARD: 'Support Ward',
  TEEMO_MUSHROOM: 'Noxious Trap',
  SHACO_BOX: 'Jack In The Box',
  JHIN_TRAP: 'Captive Audience',
  NIDALEE_TRAP: 'Bushwhack',
  CAITLYN_TRAP: 'Yordle Snap Trap',
  FIDDLESTICKS_EFFIGY: 'Scarecrow Effigy',
  ZOMBIE_WARD: 'Zombie Ward',
  GHOST_PORO: 'Ghost Poro',
};

const ALREADY_PLAIN_LEAGUE_LABELS = new Set<string>([
  ...Object.values(MONSTER_DISPLAY_LABELS),
  ...Object.values(WARD_DISPLAY_LABELS),
  'Epic Monster',
  'Ward',
  'Top Lane Turret',
  'Mid Lane Turret',
  'Bot Lane Turret',
  'Enemy Turret',
  'Top Turret Plate',
  'Mid Turret Plate',
  'Bot Turret Plate',
  'Turret Plate',
  'Top Inhibitor',
  'Mid Inhibitor',
  'Bot Inhibitor',
  'Inhibitor',
]);

/**
 * Resolves an item ID to a plain-language League item name without exposing raw numeric IDs.
 * Returns `null` when the slot is empty (`0`) or unrecorded (`null`/`undefined`).
 */
export function resolveDisplayItemName(
  itemId: number | null | undefined,
  itemMap?: Record<number | string, { name?: string }> | null
): string | null {
  if (itemId === null || itemId === undefined || !Number.isFinite(itemId) || itemId <= 0) {
    return null;
  }
  const fromMap = itemMap?.[itemId]?.name?.trim() || itemMap?.[String(itemId)]?.name?.trim();
  if (fromMap) return fromMap;
  const fromVerified = VERIFIED_ROLE_QUEST_METADATA[itemId]?.name;
  if (fromVerified) return fromVerified;
  return 'Unrecognized Item';
}

/**
 * Maps Riot monster type / subtype enums into plain League of Legends objective names,
 * never exposing raw enum tokens such as `BARON_NASHOR`, `RIFTHERALD`, `HORDE`, or `OBJECTIVE`.
 */
export function formatLeagueMonsterLabel(
  monsterType?: string | null,
  monsterSubType?: string | null
): string {
  for (const candidate of [monsterSubType, monsterType]) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    if (ALREADY_PLAIN_LEAGUE_LABELS.has(trimmed)) return trimmed;
    const upper = trimmed.toUpperCase();
    if (MONSTER_DISPLAY_LABELS[upper]) return MONSTER_DISPLAY_LABELS[upper];
  }
  return 'Epic Monster';
}

/**
 * Maps Riot lane / building enums into plain League of Legends structure names,
 * never exposing raw enum tokens such as `TOP_LANE`, `MID_LANE`, `UNKNOWN`, or `PLATE`.
 */
export function formatLeagueStructureLabel(
  laneType?: string | null,
  buildingType?: string | null,
  eventType?: string | null
): string {
  const trimmedLane = laneType?.trim();
  if (trimmedLane && ALREADY_PLAIN_LEAGUE_LABELS.has(trimmedLane)) {
    return trimmedLane;
  }
  const upperLane = trimmedLane?.toUpperCase() ?? '';
  const lanePrefix =
    upperLane === 'TOP_LANE' || upperLane === 'TOP'
      ? 'Top'
      : upperLane === 'MID_LANE' || upperLane === 'MIDDLE' || upperLane === 'MID'
      ? 'Mid'
      : upperLane === 'BOT_LANE' || upperLane === 'BOTTOM' || upperLane === 'BOT'
      ? 'Bot'
      : null;

  const upperEvent = eventType?.trim().toUpperCase() ?? '';
  const upperBuilding = buildingType?.trim().toUpperCase() ?? '';

  if (upperEvent === 'TURRET_PLATE_DESTROYED') {
    return lanePrefix ? `${lanePrefix} Turret Plate` : 'Turret Plate';
  }
  if (upperBuilding === 'INHIBITOR_BUILDING' || upperBuilding === 'INHIBITOR') {
    return lanePrefix ? `${lanePrefix} Inhibitor` : 'Inhibitor';
  }
  return lanePrefix ? `${lanePrefix} Lane Turret` : 'Enemy Turret';
}

/**
 * Maps Riot ward type enums into plain League of Legends ward names,
 * never exposing raw enum tokens such as `YELLOW_TRINKET` or `CONTROL_WARD`.
 */
export function formatLeagueWardLabel(wardType?: string | null): string {
  const trimmed = wardType?.trim();
  if (!trimmed) return 'Ward';
  if (ALREADY_PLAIN_LEAGUE_LABELS.has(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  return WARD_DISPLAY_LABELS[upper] ?? 'Ward';
}

export interface MatchRoleQuestDisplayState {
  show: boolean;
  label: string;
  tone: 'completed' | 'in_progress' | 'none' | 'missing';
}

export function isSeason2026RoleQuestEligibleMatch(
  gameVersion?: string | null,
  queueId?: number | null,
  gameDurationSeconds?: number | null,
  earlySurrender?: boolean | null
): boolean {
  const majorStr = gameVersion?.trim().split('.')[0];
  const major = majorStr ? Number.parseInt(majorStr, 10) : Number.NaN;
  if (!Number.isFinite(major) || major < 16) return false;
  if (queueId !== null && queueId !== undefined && !ROLE_QUEST_ELIGIBLE_QUEUE_IDS.has(queueId)) {
    return false;
  }
  if (typeof gameDurationSeconds === 'number' && gameDurationSeconds > 0 && gameDurationSeconds < 180) {
    return false;
  }
  if (earlySurrender === true) return false;
  return true;
}

/**
 * Describes a participant's Role Quest outcome in plain League of Legends words,
 * explicitly distinguishing missing/unrecorded legacy data (`null`/`undefined`) from zero (`0`).
 */
export function describeMatchRoleQuestState(params: {
  participant: ParticipantDto | undefined;
  gameVersion?: string | null;
  queueId?: number | null;
  gameDurationSeconds?: number | null;
  completionSeconds?: number | null;
}): MatchRoleQuestDisplayState {
  const { participant, gameVersion, queueId, gameDurationSeconds, completionSeconds } = params;
  if (!participant) {
    return { show: false, label: '', tone: 'missing' };
  }

  const cls = classifyRoleBoundItem(participant.roleBoundItem);
  const normalizedRole = (participant.teamPosition || participant.individualPosition || '')
    .trim()
    .toUpperCase();
  const eligible = isSeason2026RoleQuestEligibleMatch(
    gameVersion,
    queueId,
    gameDurationSeconds,
    participant.gameEndedInEarlySurrender
  );

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (cls.kind === 'quest_reward' || (cls.kind === 'boots' && (normalizedRole === 'BOTTOM' || normalizedRole === 'BOT'))) {
    if (typeof completionSeconds === 'number' && completionSeconds > 0) {
      return {
        show: true,
        label: `Role Quest Completed at ${formatClock(completionSeconds)}`,
        tone: 'completed',
      };
    }
    return {
      show: true,
      label: 'Role Quest Completed (exact time unavailable)',
      tone: 'completed',
    };
  }

  if (cls.kind === 'quest_starter') {
    return {
      show: true,
      label: `${cls.meta.name} in progress (not completed)`,
      tone: 'in_progress',
    };
  }

  if (cls.kind === 'boots') {
    return {
      show: true,
      label: 'Role Quest Boots equipped',
      tone: 'completed',
    };
  }

  if (cls.kind === 'unknown_item') {
    return {
      show: true,
      label: 'Role Quest slot item recorded (details unavailable for this patch)',
      tone: 'missing',
    };
  }

  if (!eligible) {
    return { show: false, label: '', tone: 'none' };
  }

  if (cls.kind === 'empty') {
    return {
      show: true,
      label: 'No Role Quest item (0 completed)',
      tone: 'none',
    };
  }

  return {
    show: true,
    label: 'Role Quest data not recorded for this match',
    tone: 'missing',
  };
}

export type RoleBoundItemClassification =
  | { kind: 'unknown' } // null / undefined (legacy un-backfilled cache — NEVER treat as 0 or missing quest)
  | { kind: 'empty' }   // explicit 0
  | { kind: 'quest_starter'; itemId: number; meta: RoleQuestItemMetadata }
  | { kind: 'quest_reward'; itemId: number; meta: RoleQuestItemMetadata }
  | { kind: 'boots'; itemId: number }
  | { kind: 'unknown_item'; itemId: number }; // unseen positive ID — preserve ID, never zero or claim quest completion

export function classifyRoleBoundItem(
  roleBoundItem: number | null | undefined
): RoleBoundItemClassification {
  if (roleBoundItem === null || roleBoundItem === undefined) {
    return { kind: 'unknown' };
  }
  if (!Number.isFinite(roleBoundItem) || roleBoundItem <= 0) {
    return { kind: 'empty' };
  }
  const meta = VERIFIED_ROLE_QUEST_METADATA[roleBoundItem];
  if (meta?.kind === 'quest_starter') {
    return { kind: 'quest_starter', itemId: roleBoundItem, meta };
  }
  if (meta?.kind === 'quest_reward') {
    return { kind: 'quest_reward', itemId: roleBoundItem, meta };
  }
  if (VERIFIED_BOOT_ITEM_IDS.has(roleBoundItem)) {
    return { kind: 'boots', itemId: roleBoundItem };
  }
  return { kind: 'unknown_item', itemId: roleBoundItem };
}

/**
 * Reconciles single-match raw `MatchTimelineDto` item purchases with `ITEM_UNDO`:
 * - Pops the most recent matching `beforeId` when `beforeId > 0`.
 * - Safely ignores `#1174` Tier 3 boot undo where `beforeId === 0` or `undefined`.
 * - Does NOT fabricate inferred Mid Tier 3 boot purchases from `ITEM_DESTROYED`.
 */
export function reconcileTimelineBuildItems(
  timeline: MatchTimelineDto | null | undefined,
  participantId: number | undefined
): BuildItem[] {
  if (!timeline?.info?.frames || !participantId) return [];
  const items: BuildItem[] = [];
  for (const frame of timeline.info.frames) {
    for (const event of frame.events || []) {
      if (event.participantId !== participantId) continue;
      if (event.type === 'ITEM_PURCHASED' && event.itemId && event.itemId > 0) {
        items.push({
          itemId: event.itemId,
          timestamp: event.timestamp || 0,
          minuteMark: Math.floor((event.timestamp || 0) / 60000),
        });
      } else if (event.type === 'ITEM_UNDO' && event.beforeId && event.beforeId > 0) {
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].itemId === event.beforeId) {
            items.splice(i, 1);
            break;
          }
        }
      }
    }
  }
  return items;
}

/**
 * Extracts single-match `SKILL_LEVEL_UP` events:
 * - Accepts `levelUpType == null || levelUpType === "NORMAL"` (excluding `"EVOLVE"`).
 * - Deduplicates `#1100` bursts sharing identical `(skillSlot, timestamp)`.
 * - Avoids imposing an 18-point hard cap so Udyr, transformation champions, and Top Quest Lv19–20 remain intact.
 */
export function extractCleanSkillUps(
  timeline: MatchTimelineDto | null | undefined,
  participantId: number | undefined
): SkillUp[] {
  if (!timeline?.info?.frames || !participantId) return [];
  const ups: SkillUp[] = [];
  const seenBurstKeys = new Set<string>();
  let currentLevel = 1;

  for (const frame of timeline.info.frames) {
    for (const event of frame.events || []) {
      if (event.participantId !== participantId) continue;
      if (event.type === 'LEVEL_UP' && event.level) {
        currentLevel = event.level;
      } else if (event.type === 'SKILL_LEVEL_UP' && event.skillSlot) {
        const isNormal =
          event.levelUpType === undefined ||
          event.levelUpType === null ||
          event.levelUpType.toUpperCase() === 'NORMAL';
        if (!isNormal) continue;
        const ts = event.timestamp ?? -1;
        if (ts >= 0) {
          const key = `${event.skillSlot}:${ts}`;
          if (seenBurstKeys.has(key)) continue;
          seenBurstKeys.add(key);
        }
        ups.push({
          skillSlot: event.skillSlot,
          level: currentLevel,
          minuteMark: Math.floor((event.timestamp || 0) / 60000),
        });
      }
    }
  }
  return ups;
}

/**
 * Conservatively extracts single-match Role Quest completion timestamp in seconds when unambiguous.
 * Returns `null` whenever `roleBoundItem` is `null` (legacy), `0`, starter item, unknown ID, or
 * timeline does not contain a single unambiguous starter-quest `ITEM_DESTROYED` event.
 */
export function extractDefensibleQuestCompletionSeconds(
  timeline: MatchTimelineDto | null | undefined,
  participant: ParticipantDto | undefined,
  participantId: number | undefined
): number | null {
  if (!timeline?.info?.frames || !participant || !participantId) return null;
  const cls = classifyRoleBoundItem(participant.roleBoundItem);
  const normalizedRole = (participant.teamPosition || participant.individualPosition || '').trim().toUpperCase();
  const isVerifiedCompleted =
    cls.kind === 'quest_reward' ||
    (cls.kind === 'boots' && (normalizedRole === 'BOTTOM' || normalizedRole === 'BOT'));
  if (!isVerifiedCompleted) return null;

  const allEvents: TimelineEventDto[] = [];
  for (const frame of timeline.info.frames) {
    if (Array.isArray(frame.events)) {
      allEvents.push(...frame.events);
    }
  }

  const starterDestroys = allEvents.filter(
    ev =>
      ev.type === 'ITEM_DESTROYED' &&
      ev.participantId === participantId &&
      typeof ev.itemId === 'number' &&
      STARTER_ROLE_QUEST_IDS.has(ev.itemId) &&
      (ev.timestamp || 0) > 60_000
  );
  if (starterDestroys.length !== 1) return null;

  const destroyTs = starterDestroys[0].timestamp;
  const hasLaterStarterBuy = allEvents.some(
    ev =>
      ev.type === 'ITEM_PURCHASED' &&
      ev.participantId === participantId &&
      typeof ev.itemId === 'number' &&
      STARTER_ROLE_QUEST_IDS.has(ev.itemId) &&
      (ev.timestamp || 0) > destroyTs
  );
  if (hasLaterStarterBuy) return null;

  return Math.round(destroyTs / 1000);
}
