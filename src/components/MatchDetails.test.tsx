import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import MatchDetails from './MatchDetails';
import type { MatchDto, ParticipantDto } from '../types/match';
import * as timelineApi from '../api/timeline';
import { useDataDragonStore } from '../store/dataDragonStore';

vi.mock('../api/timeline', () => ({
  getMatchTimeline: vi.fn(),
}));

const createParticipant = (overrides: Partial<ParticipantDto>): ParticipantDto => ({
  puuid: 'puuid-player',
  participantId: 1,
  teamId: 100,
  teamPosition: 'MIDDLE',
  championName: 'Ahri',
  riotIdGameName: 'Faker',
  riotIdTagline: 'KR1',
  summonerName: 'Faker',
  win: true,
  kills: 8,
  deaths: 2,
  assists: 9,
  goldEarned: 13500,
  totalMinionsKilled: 195,
  neutralMinionsKilled: 12,
  visionScore: 28,
  totalDamageDealtToChampions: 24500,
  physicalDamageDealtToChampions: 1500,
  magicDamageDealtToChampions: 21000,
  trueDamageDealtToChampions: 2000,
  totalDamageTaken: 14000,
  damageSelfMitigated: 8000,
  totalHeal: 3200,
  totalHealsOnTeammates: 0,
  totalDamageShieldedOnTeammates: 0,
  timeCCingOthers: 22,
  damageDealtToObjectives: 9500,
  damageDealtToTurrets: 4200,
  wardsPlaced: 11,
  wardsKilled: 4,
  detectorWardsPlaced: 3,
  item0: 3157,
  item1: 3089,
  item2: 3020,
  item3: 3135,
  item4: 3165,
  item5: 1056,
  item6: 3364,
  summoner1Id: 4,
  summoner2Id: 14,
  gameEndedInEarlySurrender: false,
  challenges: {
    abilityUses: 184,
    laneMinionsFirst10Minutes: 82,
    soloKills: 2,
    turretPlatesTaken: 3,
  },
  perks: {
    statPerks: { defense: 5002, flex: 5008, offense: 5005 },
    styles: [
      { description: 'primaryStyle', style: 8100, selections: [{ perk: 8112 }, { perk: 8126 }, { perk: 8138 }, { perk: 8135 }] },
      { description: 'subStyle', style: 8200, selections: [{ perk: 8226 }, { perk: 8210 }] },
    ],
  },
  ...overrides,
});

const sampleMatch: MatchDto = {
  metadata: {
    matchId: 'EUW1_999',
  },
  info: {
    gameId: 999,
    gameCreation: 1730000000000,
    gameDuration: 1680,
    gameVersion: '16.22.1',
    queueId: 420,
    participants: [
      createParticipant({}),
      createParticipant({
        puuid: 'puuid-opp',
        participantId: 6,
        teamId: 200,
        teamPosition: 'MIDDLE',
        championName: 'Zed',
        riotIdGameName: 'Chovy',
        riotIdTagline: 'KR1',
        win: false,
        kills: 4,
        deaths: 6,
        assists: 3,
        challenges: {
          abilityUses: 142,
          laneMinionsFirst10Minutes: 74,
        },
      }),
    ],
  },
};

describe('MatchDetails mobile viewport layout (#13)', () => {
  beforeEach(() => {
    useDataDragonStore.setState({
      cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.22.1',
      version: '16.22.1',
    });
    vi.mocked(timelineApi.getMatchTimeline).mockResolvedValue({
      metadata: {
        matchId: 'EUW1_999',
        participants: ['puuid-player', 'puuid-opp'],
      },
      info: {
        frameInterval: 60000,
        participants: [
          { participantId: 1, puuid: 'puuid-player', championName: 'Ahri' },
          { participantId: 6, puuid: 'puuid-opp', championName: 'Zed' },
        ],
        frames: [
          {
            timestamp: 60000,
            participantFrames: {},
            events: [
              { type: 'ITEM_PURCHASED', timestamp: 60000, participantId: 1, itemId: 1056 },
              { type: 'SKILL_LEVEL_UP', timestamp: 60000, participantId: 1, skillSlot: 1 },
            ],
          },
          {
            timestamp: 480000,
            participantFrames: {},
            events: [
              { type: 'ITEM_PURCHASED', timestamp: 480000, participantId: 1, itemId: 3157 },
              {
                type: 'CHAMPION_KILL',
                timestamp: 485000,
                killerId: 1,
                victimId: 6,
                assistingParticipantIds: [],
              },
            ],
          },
        ],
      },
    });
  });

  it('constrains the detail pane and 5-button tab bar with min-w-0 and compact mobile sizing while preserving desktop classes', async () => {
    render(
      <MatchDetails
        id="match-details-999"
        match={sampleMatch}
        puuid="puuid-player"
        onPlayerClick={vi.fn()}
        region="euw1"
      />
    );

    const wrapper = document.getElementById('match-details-999');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toContain('w-full');
    expect(wrapper?.className).toContain('max-w-full');
    expect(wrapper?.className).toContain('min-w-0');

    const tabs = ['Scoreboard', 'Graphs', 'Runes', 'Analysis', 'Details'];
    for (const label of tabs) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn.className).toContain('min-w-0');
      expect(btn.className).toContain('text-[10px]');
      expect(btn.className).toContain('sm:text-xs');
    }

    // Switch to Analysis tab and verify metric labels and responsive wrapping
    fireEvent.click(screen.getByRole('button', { name: 'Analysis' }));
    await waitFor(() => {
      expect(screen.getAllByText('Abilities used:').length).toBeGreaterThan(0);
    });
    const abilityLabel = screen.getAllByText('Abilities used:')[0];
    expect(abilityLabel.className).toContain('min-w-0');
    expect(abilityLabel.className).toContain('break-words');

    // Switch to Details tab and verify headings and wrapped item build strip (no min-w-max)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    await waitFor(() => {
      expect(screen.getByText('Item Build Order')).toBeInTheDocument();
    });
    expect(screen.getByText('Skill Order')).toBeInTheDocument();
    expect(screen.getByText('Key Events')).toBeInTheDocument();
    expect(wrapper?.querySelector('.min-w-max')).toBeNull();
  });
});
