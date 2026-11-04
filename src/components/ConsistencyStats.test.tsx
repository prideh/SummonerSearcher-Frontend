import { render, screen } from '@testing-library/react';
import ConsistencyStats from './ConsistencyStats';
import PlayerStats from './PlayerStats';
import AnalysisTab from './AnalysisTab';
import { useDataDragonStore } from '../store/dataDragonStore';
import {
  CLASSIC_MINION_WAVE_CONFIG,
  SEASON_2026_MINION_WAVE_CONFIG,
  calculateSpawnedLaneMinionsByMinute,
  calculateLaneCsAt10Comparison,
} from '../utils/statsCalculator';
import type { MatchDto } from '../types/match';

// Mock match data helper
const createMatch = (puuid: string, playerStats: any, opponentStats: any, role: string = 'JUNGLE'): MatchDto => {
  return {
    info: {
      gameCreation: 123,
      gameDuration: 123,
      gameEndTimestamp: 123,
      gameId: 123,
      gameMode: 'CLASSIC',
      queueId: 420,
      participants: [
        {
          puuid: puuid,
          teamId: 100,
          teamPosition: role,
          challenges: playerStats,
          championName: 'LeeSin',
          kills: 0, deaths: 0, assists: 0, win: true,
          item0: 0, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
          summoner1Id: 4, summoner2Id: 11,
          perks: { styles: [] }
        } as any,
        {
          puuid: 'opponent',
          teamId: 200,
          teamPosition: role,
          challenges: opponentStats,
          championName: 'Viego',
          kills: 0, deaths: 0, assists: 0, win: false,
          item0: 0, item1: 0, item2: 0, item3: 0, item4: 0, item5: 0, item6: 0,
          summoner1Id: 4, summoner2Id: 11,
          perks: { styles: [] }
        } as any
      ]
    }
  };
};

describe('ConsistencyStats', () => {
  const puuid = 'test-puuid';

  test('classifies rare positive stats as Strengths (Wins > Losses)', () => {
    // 1 Win, 9 Neutrals.
    // Win: Player has lead (100), Opponent has 0.
    // Neutral: Both 0.
    const matchWin = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 100 }, { earlyLaningPhaseGoldExpAdvantage: 0 }, 'TOP');
    const matchNeutral = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 0 }, 'TOP');
    
    // Create 9 neutral matches
    const matches = [matchWin, ...Array(9).fill(matchNeutral)];

    render(<ConsistencyStats matches={matches} puuid={puuid} />);

    // Should be a Strength because 1 Win > 0 Losses.
    // Displayed percentage should be Wins / Total = 1/10 = 10%.
    const strengthSection = screen.getByText('Top Strengths').closest('div');
    expect(strengthSection).toHaveTextContent('Early gold/xp lead');
    expect(strengthSection).toHaveTextContent('10%');
  });

  test('classifies rare negative stats as Weaknesses (Losses > Wins)', () => {
    // 1 Loss, 9 Neutrals.
    // Loss: Player has 0, Opponent has lead (100).
    const matchLoss = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 100 }, 'TOP');
    const matchNeutral = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 0 }, 'TOP');
    
    const matches = [matchLoss, ...Array(9).fill(matchNeutral)];

    render(<ConsistencyStats matches={matches} puuid={puuid} />);

    // Should be a Weakness because 1 Loss > 0 Wins.
    // Displayed percentage should be Losses / Total = 1/10 = 10%.
    const weaknessSection = screen.getByText('Top Weaknesses').closest('div');
    expect(weaknessSection).toHaveTextContent('Early gold/xp lead');
    expect(weaknessSection).toHaveTextContent('10%');
  });

  test('classifies common negative stats as Weaknesses', () => {
    // 8 Losses, 2 Neutrals.
    const matchLoss = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 100 }, 'TOP');
    const matchNeutral = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 0 }, 'TOP');
    
    const matches = [...Array(8).fill(matchLoss), ...Array(2).fill(matchNeutral)];

    render(<ConsistencyStats matches={matches} puuid={puuid} />);

    // Should be a Weakness because 8 Losses > 0 Wins.
    // Displayed percentage should be Losses / Total = 8/10 = 80%.
    const weaknessSection = screen.getByText('Top Weaknesses').closest('div');
    expect(weaknessSection).toHaveTextContent('Early gold/xp lead');
    expect(weaknessSection).toHaveTextContent('80%');
  });

  test('filters matches by Main Role', () => {
    // 3 TOP games (Main Role), 2 JUNGLE games (Off Role)
    
    // TOP Game 1: Loss (Weakness)
    const topMatch1 = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 100 }, 'TOP');
    // TOP Game 2: Loss (Weakness)
    const topMatch2 = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 100 }, 'TOP');
    // TOP Game 3: Loss (Weakness)
    const topMatch3 = createMatch(puuid, { earlyLaningPhaseGoldExpAdvantage: 0 }, { earlyLaningPhaseGoldExpAdvantage: 100 }, 'TOP');

    // JUNGLE Game 1: Win (Strength) - Should be IGNORED
    const jungleMatch1 = createMatch(puuid, { dragonTakedowns: 1 }, { dragonTakedowns: 0 }, 'JUNGLE');
    // JUNGLE Game 2: Win (Strength) - Should be IGNORED
    const jungleMatch2 = createMatch(puuid, { dragonTakedowns: 1 }, { dragonTakedowns: 0 }, 'JUNGLE');

    const matches = [topMatch1, topMatch2, topMatch3, jungleMatch1, jungleMatch2];

    render(<ConsistencyStats matches={matches} puuid={puuid} />);

    // Expect 'Early gold/xp lead' (TOP Weakness) to be present
    const weaknessSection = screen.getByText('Top Weaknesses').closest('div');
    expect(weaknessSection).toHaveTextContent('Early gold/xp lead');
    
    // Expect 'Dragon takedowns' (JUNGLE Strength) to be ABSENT
    // Note: We check that it's NOT in the document at all, or at least not in Strengths
    const strengthHeader = screen.queryByText('Top Strengths');
    expect(strengthHeader).not.toBeInTheDocument(); 
  });

  test('uses display name overrides', () => {
    // Create matches where player has 'earliestBaron' (Strength)
    // Need at least 3 games to pass the filter
    const match1 = createMatch(puuid, { earliestBaron: 100 }, { earliestBaron: 200 }, 'JUNGLE');
    const match2 = createMatch(puuid, { earliestBaron: 100 }, { earliestBaron: 200 }, 'JUNGLE');
    const match3 = createMatch(puuid, { earliestBaron: 100 }, { earliestBaron: 200 }, 'JUNGLE');

    render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);

    // Expect 'First Baron' instead of 'Earliest Baron'
    const strengthSection = screen.getByText('Top Strengths').closest('div');
    expect(strengthSection).toHaveTextContent('First Baron');
    expect(strengthSection).not.toHaveTextContent('Earliest Baron');

    // Test another override
    // Test another override
    createMatch(puuid, { damageTakenOnTeamPercentage: 0.5 }, { damageTakenOnTeamPercentage: 0.2 }, 'TOP');
    // We need 3 matches for it to show up, so let's just reuse the match creation logic or add to the existing matches if possible, 
    // but the existing test uses [match1, match2, match3] which are all JUNGLE matches.
    // Let's create a new test case for this specific override to be clean or append to the list.
    // Actually, let's just add it to the existing test by creating a new render.
  });

  test('uses display name overrides for damage taken', () => {
     const match1 = createMatch(puuid, { damageTakenOnTeamPercentage: 0.5 }, { damageTakenOnTeamPercentage: 0.2 }, 'TOP');
     const match2 = createMatch(puuid, { damageTakenOnTeamPercentage: 0.5 }, { damageTakenOnTeamPercentage: 0.2 }, 'TOP');
     const match3 = createMatch(puuid, { damageTakenOnTeamPercentage: 0.5 }, { damageTakenOnTeamPercentage: 0.2 }, 'TOP');

     render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);
     
     const strengthSection = screen.getByText('Top Strengths').closest('div');
     expect(strengthSection).toHaveTextContent('Damage taken compared to opponent');
  });

  test('excludes legendaryCount', () => {
    const match1 = createMatch(puuid, { legendaryCount: 10 }, { legendaryCount: 0 }, 'TOP');
    const match2 = createMatch(puuid, { legendaryCount: 10 }, { legendaryCount: 0 }, 'TOP');
    const match3 = createMatch(puuid, { legendaryCount: 10 }, { legendaryCount: 0 }, 'TOP');

    render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);

    // Should NOT be in the document
    expect(screen.queryByText('Legendary streaks')).not.toBeInTheDocument();
  });

  test('excludes Jungle-specific stats for non-Junglers', () => {
    // Player is TOP main
    const match1 = createMatch(puuid, { earliestBaron: 100 }, { earliestBaron: 200 }, 'TOP');
    const match2 = createMatch(puuid, { earliestBaron: 100 }, { earliestBaron: 200 }, 'TOP');
    const match3 = createMatch(puuid, { earliestBaron: 100 }, { earliestBaron: 200 }, 'TOP');

    render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);

    // 'First Baron' should be ignored because it's a JUNGLE stat and player is TOP
    expect(screen.queryByText('First Baron')).not.toBeInTheDocument();

    // 'Objectives taken near enemy jungler' should also be ignored
    createMatch(puuid, { epicMonsterKillsNearEnemyJungler: 5 }, { epicMonsterKillsNearEnemyJungler: 0 }, 'TOP');
    createMatch(puuid, { epicMonsterKillsNearEnemyJungler: 5 }, { epicMonsterKillsNearEnemyJungler: 0 }, 'TOP');
    createMatch(puuid, { epicMonsterKillsNearEnemyJungler: 5 }, { epicMonsterKillsNearEnemyJungler: 0 }, 'TOP');
    
    // Re-render with new matches (or just add to the list if we want to test all at once, but separate render is cleaner for this specific check)
    // Actually, let's just make a new test block for clarity or append to this one.
    // Appending to this one requires re-rendering which might be tricky with screen queries if not careful.
    // Let's just create a new test.
  });

  test('excludes Objectives taken near enemy jungler for non-Junglers', () => {
      const match1 = createMatch(puuid, { epicMonsterKillsNearEnemyJungler: 5 }, { epicMonsterKillsNearEnemyJungler: 0 }, 'TOP');
      const match2 = createMatch(puuid, { epicMonsterKillsNearEnemyJungler: 5 }, { epicMonsterKillsNearEnemyJungler: 0 }, 'TOP');
      const match3 = createMatch(puuid, { epicMonsterKillsNearEnemyJungler: 5 }, { epicMonsterKillsNearEnemyJungler: 0 }, 'TOP');
  
      render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);
  
      expect(screen.queryByText('Objectives taken near enemy jungler')).not.toBeInTheDocument();
  });

  test('uses display name overrides for turret plates', () => {
    const match1 = createMatch(puuid, { turretPlatesTaken: 5 }, { turretPlatesTaken: 0 }, 'TOP');
    const match2 = createMatch(puuid, { turretPlatesTaken: 5 }, { turretPlatesTaken: 0 }, 'TOP');
    const match3 = createMatch(puuid, { turretPlatesTaken: 5 }, { turretPlatesTaken: 0 }, 'TOP');

    render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);

    const strengthSection = screen.getByText('Top Strengths').closest('div');
    expect(strengthSection).toHaveTextContent('Plates lead vs opponent');
  });

  test('excludes Buffs stolen for non-Junglers', () => {
    // Create matches where the player is TOP and has high buffsStolen
    const match1 = createMatch(puuid, { buffsStolen: 5 }, { buffsStolen: 0 }, 'TOP');
    const match2 = createMatch(puuid, { buffsStolen: 5 }, { buffsStolen: 0 }, 'TOP');
    const match3 = createMatch(puuid, { buffsStolen: 5 }, { buffsStolen: 0 }, 'TOP');

    render(<ConsistencyStats matches={[match1, match2, match3]} puuid={puuid} />);

    // Should NOT show "Buffs stolen" because main role is TOP
    expect(screen.queryByText('Buffs stolen')).not.toBeInTheDocument();
  });

  test('uses ALL matches when there is a tie in role frequency (Multirole)', () => {
    // 2 TOP games, 2 MID games. Should use ALL 4 games.
    // In the TOP games, we'll have a specific stat (e.g., soloKills) that we want to track.
    // In the MID games, we'll have the SAME stat.
    // If it filtered to just TOP, we'd only see 2 games worth of data.
    // If it uses ALL, we see 4.
    
    // Let's use 'damagePerMinute' which is not role restricted and not excluded.
    // Match 1 & 2: TOP, Won DPM
    const match1 = createMatch(puuid, { damagePerMinute: 1000 }, { damagePerMinute: 500 }, 'TOP');
    const match2 = createMatch(puuid, { damagePerMinute: 1000 }, { damagePerMinute: 500 }, 'TOP');
    
    // Match 3 & 4: MID, Won DPM
    const match3 = createMatch(puuid, { damagePerMinute: 1000 }, { damagePerMinute: 500 }, 'MIDDLE');
    const match4 = createMatch(puuid, { damagePerMinute: 1000 }, { damagePerMinute: 500 }, 'MIDDLE');

    render(<ConsistencyStats matches={[match1, match2, match3, match4]} puuid={puuid} />);

    // We need to verify that it considered all 4 games.
    // The component doesn't explicitly show "Games Analyzed", but we can infer it 
    // if we had a stat that only appeared in the "other" role.
    
    // Actually, let's use a simpler check. If it filtered to TOP, it would only see 2 games.
    // Our logic filters out stats with < 3 games.
    // So if it filters to TOP, 'damagePerMinute' (2 games) would be HIDDEN.
    // If it uses ALL (4 games), 'damagePerMinute' should be VISIBLE.
    
    const strengthSection = screen.getByText('Top Strengths').closest('div');
    expect(strengthSection).toHaveTextContent('Damage per minute');
  });

  test('includes laneMinionsFirst10Minutes for laners (TOP, MIDDLE, BOTTOM) and excludes it for JUNGLE and UTILITY', () => {
    const midMatches = [
      createMatch(puuid, { laneMinionsFirst10Minutes: 85 }, { laneMinionsFirst10Minutes: 65 }, 'MIDDLE'),
      createMatch(puuid, { laneMinionsFirst10Minutes: 88 }, { laneMinionsFirst10Minutes: 70 }, 'MIDDLE'),
      createMatch(puuid, { laneMinionsFirst10Minutes: 90 }, { laneMinionsFirst10Minutes: 72 }, 'MIDDLE'),
    ];

    const { unmount } = render(<ConsistencyStats matches={midMatches} puuid={puuid} />);
    expect(screen.getByText('Top Strengths').closest('div')).toHaveTextContent('Lane minions @ 10 min');
    unmount();

    const supportMatches = [
      createMatch(puuid, { laneMinionsFirst10Minutes: 30 }, { laneMinionsFirst10Minutes: 15 }, 'UTILITY'),
      createMatch(puuid, { laneMinionsFirst10Minutes: 28 }, { laneMinionsFirst10Minutes: 12 }, 'UTILITY'),
      createMatch(puuid, { laneMinionsFirst10Minutes: 35 }, { laneMinionsFirst10Minutes: 10 }, 'UTILITY'),
    ];
    const { unmount: unmountSupport } = render(<ConsistencyStats matches={supportMatches} puuid={puuid} />);
    expect(screen.queryByText('Lane minions @ 10 min')).not.toBeInTheDocument();
    unmountSupport();

    const jungleMatches = [
      createMatch(puuid, { laneMinionsFirst10Minutes: 20 }, { laneMinionsFirst10Minutes: 5 }, 'JUNGLE'),
      createMatch(puuid, { laneMinionsFirst10Minutes: 22 }, { laneMinionsFirst10Minutes: 8 }, 'JUNGLE'),
      createMatch(puuid, { laneMinionsFirst10Minutes: 18 }, { laneMinionsFirst10Minutes: 4 }, 'JUNGLE'),
    ];
    render(<ConsistencyStats matches={jungleMatches} puuid={puuid} />);
    expect(screen.queryByText('Lane minions @ 10 min')).not.toBeInTheDocument();
  });

  test('computes spawned lane minion ceiling by 10:00 from patch-parameterized spawn rules with explicit timing uncertainty', () => {
    // Classic 1:05 first spawn -> 18 waves spawn strictly before 10:00 (01:05 .. 09:35, 6 cannon waves on 3,6,9,12,15,18) = 114 minions spawned
    const classicResult = calculateSpawnedLaneMinionsByMinute(10, CLASSIC_MINION_WAVE_CONFIG);
    expect(classicResult.wavesSpawned).toBe(18);
    expect(classicResult.cannonWavesSpawned).toBe(6);
    expect(classicResult.spawnedMinions).toBe(114);

    // Season 2026 (Patch 26.1 / DDragon 16.x) 0:30 first spawn -> 20 waves spawn strictly before 10:00 (00:30 .. 09:30, 6 cannon waves on 3,6,9,12,15,18) = 126 minions spawned
    const season2026Result = calculateSpawnedLaneMinionsByMinute(10, SEASON_2026_MINION_WAVE_CONFIG);
    expect(season2026Result.wavesSpawned).toBe(20);
    expect(season2026Result.cannonWavesSpawned).toBe(6);
    expect(season2026Result.spawnedMinions).toBe(126);

    const comparisonClassic = calculateLaneCsAt10Comparison(80, '15.24.1');
    expect(comparisonClassic).toEqual({
      actual: 80,
      spawnedCeiling: 114,
      wavesSpawned: 18,
      cannonWavesSpawned: 6,
      uncertaintyNote: 'Final 1–2 spawned waves may still be in transit at 10:00 (arrival timing unverified)',
    });
    expect('missed' in (comparisonClassic as unknown as Record<string, unknown>)).toBe(false);

    const comparisonSeason2026 = calculateLaneCsAt10Comparison(84, '16.5.1');
    expect(comparisonSeason2026).toEqual({
      actual: 84,
      spawnedCeiling: 126,
      wavesSpawned: 20,
      cannonWavesSpawned: 6,
      uncertaintyNote: 'Final 1–2 spawned waves may still be in transit at 10:00 (arrival timing unverified)',
    });
    expect('missed' in (comparisonSeason2026 as unknown as Record<string, unknown>)).toBe(false);
  });

  test('renders role-gated CS@10 actual vs spawned ceiling with timing uncertainty in PlayerStats and AnalysisTab only for laners', () => {
    useDataDragonStore.setState({
      version: '16.5.1',
      versionReady: true,
      cdnUrl: 'https://ddragon.leagueoflegends.com/cdn/16.5.1',
      itemMap: {},
      summonerSpellMap: {},
      runeMap: {},
      championMap: {},
    });

    const lanerMatch = createMatch(
      puuid,
      { laneMinionsFirst10Minutes: 84, jungleCsBefore10Minutes: 4 },
      { laneMinionsFirst10Minutes: 70, jungleCsBefore10Minutes: 8 },
      'TOP'
    );
    lanerMatch.info!.gameVersion = '16.5.1';
    const lanerParticipant = lanerMatch.info!.participants[0];

    const { unmount } = render(
      <PlayerStats participant={lanerParticipant} teamParticipants={lanerMatch.info!.participants} />
    );
    const badge = screen.getByTestId('lane-cs-10');
    expect(badge).toHaveTextContent('CS@10: 84 (≤126 spawned*)');
    expect(badge.getAttribute('title')).toContain('Spawned ceiling: 126 (20 waves; Final 1–2 spawned waves may still be in transit at 10:00 (arrival timing unverified))');
    expect(badge.textContent).not.toMatch(/missed/i);
    unmount();

    const supportMatch = createMatch(
      puuid,
      { laneMinionsFirst10Minutes: 18 },
      { laneMinionsFirst10Minutes: 12 },
      'UTILITY'
    );
    const supportParticipant = supportMatch.info!.participants[0];
    const { unmount: unmountSupport } = render(
      <PlayerStats participant={supportParticipant} teamParticipants={supportMatch.info!.participants} />
    );
    expect(screen.queryByTestId('lane-cs-10')).not.toBeInTheDocument();
    unmountSupport();

    const { unmount: unmountAnalysisLaner } = render(
      <AnalysisTab match={lanerMatch} puuid={puuid} onPlayerClick={() => {}} />
    );
    expect(screen.getAllByText('Lane minions @ 10 min:').length).toBeGreaterThan(0);
    expect(screen.getByText(/84 last-hit/)).toHaveTextContent('84 last-hit (≤126 spawned, ±1–2 waves in transit)');
    expect(screen.queryByText(/missed/i)).not.toBeInTheDocument();
    // Jungle CS @ 10 min should be filtered out for TOP laners
    expect(screen.queryByText('Jungle cs @ 10 min:')).not.toBeInTheDocument();
    unmountAnalysisLaner();

    render(<AnalysisTab match={supportMatch} puuid={puuid} onPlayerClick={() => {}} />);
    expect(screen.queryByText('Lane minions @ 10 min:')).not.toBeInTheDocument();
  });

  test('syncs champion tags dynamically from Data Dragon at runtime with committed fallback', async () => {
    const {
      COMMITTED_DDRAGON_VERSION,
      getChampionTags,
      hasTag,
      setRuntimeChampionTags,
      syncChampionTagsFromDDragon,
    } = await import('../utils/championTags');

    expect(COMMITTED_DDRAGON_VERSION).toBe('16.22.1');
    expect(hasTag('Leona', 'Tank')).toBe(true);

    // Simulate a new/updated patch champion payload fetched from Data Dragon at runtime
    syncChampionTagsFromDDragon({
      NewPatchHero: {
        id: 'NewPatchHero',
        name: 'New Patch Hero',
        tags: ['Support', 'Mage'],
      },
    });

    expect(getChampionTags('NewPatchHero')).toEqual(['Support', 'Mage']);
    expect(getChampionTags('New Patch Hero')).toEqual(['Support', 'Mage']);
    // Committed fallback still works for champions not present in partial payload
    expect(hasTag('Leona', 'Tank')).toBe(true);

    setRuntimeChampionTags(null);
  });
});
