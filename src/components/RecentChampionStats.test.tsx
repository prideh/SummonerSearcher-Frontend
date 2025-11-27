import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RecentChampionStats from './RecentChampionStats';
import type { MatchDto } from '../types/match';

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(() => 'https://ddragon.leagueoflegends.com/cdn/14.22.1'),
}));

// Helper to create a partial match object
const createMatch = (puuid: string, turretPlates: number): MatchDto => {
  return {
    info: {
      gameId: 123,
      gameDuration: 1800, // 30 min
      participants: [
        {
          puuid,
          championName: 'Aatrox',
          win: true,
          teamId: 100,
          kills: 5,
          deaths: 2,
          assists: 10,
          challenges: {
            turretPlatesTaken: turretPlates,
            soloKills: 1,
          },
          totalMinionsKilled: 200,
          neutralMinionsKilled: 0,
        },
      ],
    } as any,
  };
};

describe('RecentChampionStats', () => {
  const puuid = 'test-puuid';

  it('calculates and displays Avg Tower Plates', () => {
    const match1 = createMatch(puuid, 2);
    const match2 = createMatch(puuid, 4);
    
    // Avg should be (2 + 4) / 2 = 3

    render(<RecentChampionStats matches={[match1, match2]} puuid={puuid} />);

    // Check for the label
    expect(screen.getByText('Avg Tower Plates:')).toBeInTheDocument();
    
    // Check for the value
    // Since it's formatted to 1 decimal place, it should be "3.0"
    expect(screen.getByText('3.0')).toBeInTheDocument();
  });

  it('calculates and displays Opponent Stats', () => {
    // Match 1: Player (Mid) vs Opponent (Mid)
    // Player: 5/2/10, 200 CS, 1 Solo Kill, 2 Plates
    // Opponent: 2/5/2, 150 CS, 0 Solo Kill, 0 Plates
    const match1: MatchDto = {
      info: {
        gameId: 123,
        gameDuration: 1800, // 30 min
        participants: [
          {
            puuid: 'test-puuid',
            championName: 'Ahri',
            teamId: 100,
            teamPosition: 'MIDDLE',
            win: true,
            kills: 5,
            deaths: 2,
            assists: 10,
            totalMinionsKilled: 200,
            neutralMinionsKilled: 0,
            challenges: { soloKills: 1, turretPlatesTaken: 2 },
          },
          {
            puuid: 'opponent-puuid',
            championName: 'Zed',
            teamId: 200,
            teamPosition: 'MIDDLE',
            win: false,
            kills: 2,
            deaths: 5,
            assists: 2,
            totalMinionsKilled: 150,
            neutralMinionsKilled: 0,
            challenges: { soloKills: 0, turretPlatesTaken: 0 },
          },
        ],
      } as any,
    };

    render(<RecentChampionStats matches={[match1]} puuid="test-puuid" />);

    // Check for Opponent Stats Labels/Values
    // We expect "vs" format or similar. Let's assume we implement it as "Value (Opp Value)" or similar compact style.
    // Based on user request "add the opponents stat's as well", let's look for the opponent values.
    
    // Opponent KDA: (2+2)/5 = 0.8
    expect(screen.getByText(/0.80/)).toBeInTheDocument(); 

    // Opponent CS/m: 150 / 30 = 5.0
    expect(screen.getByText(/5.0/)).toBeInTheDocument();

    // Opponent Avg Solokills: 0.0
    // Opponent Avg Plates: 0.0
  });
});
