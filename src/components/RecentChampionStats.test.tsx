import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RecentChampionStats from './RecentChampionStats';

// Mock store
vi.mock('../store/dataDragonStore', () => ({
  useDataDragonStore: vi.fn(() => 'https://ddragon.leagueoflegends.com/cdn/14.22.1'),
}));

describe('RecentChampionStats', () => {
  it('calculates and displays Avg Tower Plates', () => {
    const mockChampionStats = [{
        championName: 'Aatrox',
        games: 2,
        wins: 1,
        losses: 1,
        kills: 10,
        deaths: 4,
        assists: 20,
        cs: 400,
        averageCsPerMinute: 8.0,
        averageSoloKills: 1.0,
        averageTurretPlates: 3.0, // (2+4)/2
        averageKills: 5.0,
        averageDeaths: 2.0,
        averageAssists: 10.0,
        winRate: 50,
        kda: 7.5,
        soloKills: 2,
        turretPlates: 6,
        totalDamageDealt: 10000,
        damagePerMinute: 500,
        goldEarned: 20000,
        goldPerMinute: 400,
        visionScore: 20,
        visionScorePerMinute: 1.0
    }];

    const mockOverallStats = {
        wins: 1,
        losses: 1,
        winRate: 50,
        kda: 7.5,
        avgKills: 5,
        avgDeaths: 2,
        avgAssists: 10,
        avgCsPerMinute: 8.0,
        avgVisionScore: 10,
        avgSoloKills: 1.0,
        avgTurretPlates: 3.0,
        avgKillParticipation: 50,
        blueSide: { games: 1, wins: 1, winRate: 100 },
        redSide: { games: 1, wins: 0, winRate: 0 },
        oppAvgKda: 0,
        oppAvgKillParticipation: 0,
        oppAvgCsPerMinute: 0,
        oppAvgSoloKills: 0,
        oppAvgTurretPlates: 0,
        oppAvgVisionScore: 0
    };

    render(<RecentChampionStats championStats={mockChampionStats} overallStats={mockOverallStats} />);

    // Check for the label
    expect(screen.getByText('Avg Tower Plates:')).toBeInTheDocument();
    
    // Check for the value
    expect(screen.getByText('3.0')).toBeInTheDocument();
  });

  it('calculates and displays Opponent Stats', () => {
    const mockChampionStats: any[] = [];
    const mockOverallStats = {
        wins: 1,
        losses: 0,
        winRate: 100,
        kda: 7.5,
        avgKills: 5,
        avgDeaths: 2,
        avgAssists: 10,
        avgCsPerMinute: 6.6, // 200 / 30
        avgVisionScore: 0,
        avgSoloKills: 1.0,
        avgTurretPlates: 2.0,
        avgKillParticipation: 50,
        blueSide: { games: 1, wins: 1, winRate: 100 },
        redSide: { games: 0, wins: 0, winRate: 0 },
        oppAvgKda: 0.8, // (2+2)/5
        oppAvgKillParticipation: 0,
        oppAvgCsPerMinute: 5.0, // 150 / 30
        oppAvgSoloKills: 0,
        oppAvgTurretPlates: 0,
        oppAvgVisionScore: 0
    };

    render(<RecentChampionStats championStats={mockChampionStats} overallStats={mockOverallStats} />);

    // Check for Opponent Stats Labels/Values
    expect(screen.getByText(/0.80/)).toBeInTheDocument(); 
    expect(screen.getByText(/5.0/)).toBeInTheDocument();
  });
});
