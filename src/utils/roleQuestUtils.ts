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
    shortLabel: 'Top Quest (In Progress)',
    summary: 'Season 2026 Top Lane Role Quest starter (in progress).',
    kind: 'quest_starter',
  },
  1201: {
    id: 1201,
    name: 'Mid Lane Quest',
    shortLabel: 'Mid Quest (In Progress)',
    summary: 'Season 2026 Mid Lane Role Quest starter (in progress).',
    kind: 'quest_starter',
  },
  1202: {
    id: 1202,
    name: 'Bot Lane Quest',
    shortLabel: 'Bot Quest (In Progress)',
    summary: 'Season 2026 Bot Lane Role Quest starter (in progress).',
    kind: 'quest_starter',
  },
  1203: {
    id: 1203,
    name: 'Support Quest',
    shortLabel: 'Support Quest (In Progress)',
    summary: 'Season 2026 Support Role Quest starter (in progress).',
    kind: 'quest_starter',
  },
  1204: {
    id: 1204,
    name: 'Jungle Quest',
    shortLabel: 'Jungle Quest (In Progress)',
    summary: 'Season 2026 Jungle Role Quest starter (in progress).',
    kind: 'quest_starter',
  },
  1222: {
    id: 1222,
    name: 'Top Lane Quest',
    shortLabel: 'Top Quest (In Progress)',
    summary: 'Season 2026 Top Lane Role Quest starter variant (in progress).',
    kind: 'quest_starter',
  },
  1205: {
    id: 1205,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest: evolved pet, upgraded Smite, bonus large-monster gold/XP & jungle MS.',
    kind: 'quest_reward',
  },
  1206: {
    id: 1206,
    name: 'Mid Lane Quest Reward',
    shortLabel: 'Mid Quest Complete',
    summary: 'Completed Mid Lane Role Quest: unlocks Tier 3 Boots and grants +8% bonus Attack Damage and Ability Power (Patch 26.22).',
    kind: 'quest_reward',
  },
  1207: {
    id: 1207,
    name: 'Bot Lane Quest Reward',
    shortLabel: 'Bot Quest Complete',
    summary: 'Completed Bot Lane Role Quest: +300g lump sum, dedicated 7th-slot Boots freeing 6 inventory slots, +2g/minion, +40g/takedown (Patch 26.22).',
    kind: 'quest_reward',
  },
  1208: {
    id: 1208,
    name: 'Support Quest Reward',
    shortLabel: 'Support Quest Complete',
    summary: 'Completed Support Role Quest: dedicated Control Ward slot, 40g Control Wards, and upgraded gold generation.',
    kind: 'quest_reward',
  },
  1209: {
    id: 1209,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest: evolved companion, upgraded Smite, bonus large-monster gold/XP & jungle MS.',
    kind: 'quest_reward',
  },
  1210: {
    id: 1210,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest variant.',
    kind: 'quest_reward',
  },
  1211: {
    id: 1211,
    name: 'Jungle Quest Reward',
    shortLabel: 'Jungle Quest Complete',
    summary: 'Completed Jungle Role Quest variant.',
    kind: 'quest_reward',
  },
  1220: {
    id: 1220,
    name: 'Unleashed Teleport (Top Lane Quest Reward)',
    shortLabel: 'Top Quest: Unleashed TP',
    summary: 'Completed Top Lane Role Quest: level cap raised to 20, bonus XP, and Unleashed Teleport (390s base CD in Patch 26.22).',
    kind: 'quest_reward',
  },
  1221: {
    id: 1221,
    name: 'Top Lane Quest Reward',
    shortLabel: 'Top Quest: Enhanced TP',
    summary: 'Completed Top Lane Role Quest: level cap raised to 20, bonus XP, and arrival max-HP shield on Teleport.',
    kind: 'quest_reward',
  },
  3170: {
    id: 3170,
    name: 'Swiftmarch',
    shortLabel: 'Swiftmarch (T3)',
    summary: 'Mid Role Quest Tier 3 upgrade from Boots of Swiftness (1000g total).',
    kind: 'tier3_boots',
  },
  3171: {
    id: 3171,
    name: 'Crimson Lucidity',
    shortLabel: 'Crimson Lucidity (T3)',
    summary: 'Mid Role Quest Tier 3 upgrade from Ionian Boots of Lucidity (900g total).',
    kind: 'tier3_boots',
  },
  3172: {
    id: 3172,
    name: 'Gunmetal Greaves',
    shortLabel: 'Gunmetal Greaves (T3)',
    summary: 'Mid Role Quest Tier 3 upgrade from Berserker\'s Greaves (1100g total; note: omits "Boots" tag in DDragon).',
    kind: 'tier3_boots',
  },
  3173: {
    id: 3173,
    name: 'Chainlaced Crushers',
    shortLabel: 'Chainlaced Crushers (T3)',
    summary: 'Mid Role Quest Tier 3 upgrade from Mercury\'s Treads (1250g total).',
    kind: 'tier3_boots',
  },
  3174: {
    id: 3174,
    name: 'Armored Advance',
    shortLabel: 'Armored Advance (T3)',
    summary: 'Mid Role Quest Tier 3 upgrade from Plated Steelcaps (1200g total).',
    kind: 'tier3_boots',
  },
  3175: {
    id: 3175,
    name: "Spellslinger's Shoes",
    shortLabel: "Spellslinger's Shoes (T3)",
    summary: 'Mid Role Quest Tier 3 upgrade from Sorcerer\'s Shoes (1100g total).',
    kind: 'tier3_boots',
  },
  3176: {
    id: 3176,
    name: 'Forever Forward',
    shortLabel: 'Forever Forward (T3)',
    summary: 'Mid Role Quest Tier 3 upgrade from Synchronized Souls (900g total).',
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
