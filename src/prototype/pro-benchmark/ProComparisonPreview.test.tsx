import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ProComparisonPreview from './ProComparisonPreview';
import {
  DEFAULT_PRO_BENCHMARK_DATASET,
  VERIFIED_HUD_10M_VOD_BY_GAME_ID,
  computeProComparisonSlice,
  evaluateDemoCsComparisons,
  getSupportedRoleChampionOptions,
} from './proBenchmarkEngine';
import type { RawProBenchmarkDataset } from './proBenchmarkTypes';

describe('ProComparisonPreview & proBenchmarkEngine behavioral suite', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Unexpected live network fetch call in ProComparisonPreview');
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('verifies actual dataset scope: 8 games, 80 player observations, 53 role-champion pairs in JSON (vs 57 report heading), patch 16.20', () => {
    const pairs = getSupportedRoleChampionOptions(DEFAULT_PRO_BENCHMARK_DATASET, 'ALL');
    expect(DEFAULT_PRO_BENCHMARK_DATASET.games).toHaveLength(8);
    expect(pairs).toHaveLength(53);
    expect(pairs.reduce((sum, p) => sum + p.sampleCount, 0)).toBe(80);

    const slice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'top',
      championId: 'KSante',
    });
    expect(slice.totalGamesInDataset).toBe(8);
    expect(slice.totalObservationsInDataset).toBe(80);
    expect(slice.totalRoleChampionPairsInDataset).toBe(53);
    expect(slice.reportClaimedRoleChampionPairs).toBe(57);
    expect(slice.patchShort).toBe('16.20');
    expect(slice.ddragonVersionUsedInIngest).toBe('16.22.1');
  });

  it('computes exact mean Total CS (including jungle) at 5/10/15/20/25m and honest Unavailable at 30m for Top · KSante', () => {
    render(<ProComparisonPreview />);

    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('2. Top · KSante');
    expect(screen.getByTestId('active-selection-sample-badge')).toHaveTextContent(
      'Sample: 3 Player-Games (3/8 Matches)'
    );

    // 5m, 10m, 15m, 20m, 25m are available with 3/3G reached (n=3)
    expect(screen.getByTestId('checkpoint-denom-5m')).toHaveTextContent('3/3G reached (n=3)');
    expect(screen.getByTestId('checkpoint-mean-cs-5m')).toHaveTextContent('39.0 CS');

    expect(screen.getByTestId('checkpoint-denom-10m')).toHaveTextContent('3/3G reached (n=3)');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('93.0 CS');
    expect(screen.getByTestId('checkpoint-range-cs-10m')).toHaveTextContent('90–98 CS');

    expect(screen.getByTestId('checkpoint-denom-15m')).toHaveTextContent('3/3G reached (n=3)');
    expect(screen.getByTestId('checkpoint-mean-cs-15m')).toHaveTextContent('137.3 CS');

    expect(screen.getByTestId('checkpoint-denom-20m')).toHaveTextContent('3/3G reached (n=3)');
    expect(screen.getByTestId('checkpoint-mean-cs-20m')).toHaveTextContent('179.7 CS');

    // 25m is computed directly from games[].aligned_checkpoints['25m'].true_in_game_clock.pCs:
    // IG TheShy G4 (227), HLE Zeus BLGvHLE G2 (225), HLE Zeus G2vHLE G1 (217) -> (227+225+217)/3 = 223.0 CS
    expect(screen.getByTestId('checkpoint-denom-25m')).toHaveTextContent('3/3G reached (n=3)');
    expect(screen.getByTestId('checkpoint-mean-cs-25m')).toHaveTextContent('223.0 CS');

    // 30m has 0 exported snapshots in JSON (2 of the 3 KSante games lasted >=30:00, 1 ended at 28:06 <30:00)
    expect(screen.getByTestId('checkpoint-denom-30m')).toHaveTextContent(
      '0/3G snapshot (2/3G reached 30:00)'
    );
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent('Unavailable');
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent(
      '2 of 3 sample games lasted ≥30:00 (1 ended <30:00), but the sample dataset only exported checkpoints through 25m'
    );
  });

  it('updates role and champion filters accurately including Jungle total CS', () => {
    render(<ProComparisonPreview />);

    // Click Jungle role pill
    fireEvent.click(screen.getByTestId('role-pill-jungle'));
    // Select All Supported Champions in Jungle
    fireEvent.change(screen.getByTestId('pro-champion-select'), {
      target: { value: 'ALL' },
    });

    expect(screen.getByTestId('active-selection-title')).toHaveTextContent(
      '2. Jungle · All Supported Champions in Sample'
    );
    expect(screen.getByTestId('checkpoint-denom-10m')).toHaveTextContent('16/16G reached (n=16)');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('78.9 CS');
    expect(screen.getByTestId('checkpoint-mean-cs-15m')).toHaveTextContent('120.2 CS');

    // Select specific Jungle pair: Qiyana (2 games: G2 SkewMond, IG Wei)
    fireEvent.click(screen.getByTestId('quick-pair-jungle-Qiyana'));
    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('2. Jungle · Qiyana');
    expect(screen.getByTestId('checkpoint-denom-10m')).toHaveTextContent('2/2G reached (n=2)');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('84.0 CS');
  });

  it('handles empty and unsupported champion or role selections honestly without fallback numbers', () => {
    render(<ProComparisonPreview />);

    // Search for an unsupported champion not in the 8-game sample
    const searchInput = screen.getByTestId('pro-champion-search');
    fireEvent.change(searchInput, { target: { value: 'Ahri' } });

    expect(screen.getByTestId('unsupported-selection-state')).toBeInTheDocument();
    expect(screen.getByTestId('unsupported-selection-state')).toHaveTextContent(
      '"Ahri" is not among the 53 champion-role pairs in this 8-game (80 player-game) Worlds 2026 sample dataset.'
    );
    expect(screen.queryByTestId('checkpoint-cards-grid')).not.toBeInTheDocument();

    // Search for a champion that exists in Mid (Syndra) while Role is still Top
    fireEvent.change(searchInput, { target: { value: 'Syndra' } });
    expect(screen.getByTestId('unsupported-selection-state')).toHaveTextContent(
      'Syndra has 0 games in Top in this 8-game Worlds 2026 sample, but is present in: Mid (n=3).'
    );

    // One-click switch to supported Mid · Syndra
    fireEvent.click(screen.getByTestId('switch-supported-mid-Syndra'));
    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('2. Mid · Syndra');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('96.0 CS');
  });

  it('never substitutes zeros after a game ends and excludes short games from later checkpoint denominators', () => {
    // Construct a synthetic 3-game slice from the real dataset where:
    // - Game 1 ends at 18:00 (1080s) -> reaches 5m, 10m, 15m; ends before 20m, 25m, 30m
    // - Game 2 ends at 22:00 (1320s) -> reaches 5m, 10m, 15m, 20m; ends before 25m, 30m
    // - Game 3 ends at 27:00 (1620s) -> reaches 5m..25m; ends before 30m
    const customDataset: RawProBenchmarkDataset = JSON.parse(
      JSON.stringify(DEFAULT_PRO_BENCHMARK_DATASET)
    );
    // Find the 3 games where KSante is played
    const ksanteGames = customDataset.games.filter((g) =>
      Object.values(g.participants).some(
        (p) => p.role === 'top' && p.championId === 'KSante'
      )
    );
    expect(ksanteGames).toHaveLength(3);

    ksanteGames[0].true_in_game_duration_s = 1080; // 18:00 (ends before 20m & 25m)
    ksanteGames[1].true_in_game_duration_s = 1320; // 22:00 (ends before 25m)
    ksanteGames[2].true_in_game_duration_s = 1620; // 27:00 (reaches 25m, ends before 30m)

    render(<ProComparisonPreview dataset={customDataset} />);

    // At 15m: all 3 games reached 15:00
    expect(screen.getByTestId('checkpoint-denom-15m')).toHaveTextContent('3/3G reached (n=3)');

    // At 20m: only 2 of 3 games reached 20:00 (1 ended <20m excluded, NOT counted as 0!)
    expect(screen.getByTestId('checkpoint-denom-20m')).toHaveTextContent(
      '2/3G reached (n=2) · 1 ended <20m'
    );
    expect(screen.getByTestId('checkpoint-short-note-20m')).toHaveTextContent(
      '1 game ended before 20:00 and is excluded (never counted as 0 CS).'
    );
    // Verify mean at 20m is the mean of ksanteGames[1] (168) and ksanteGames[2] (188) = 178.0, NOT (168+188+0)/3 = 118.7!
    expect(screen.getByTestId('checkpoint-mean-cs-20m')).toHaveTextContent('178.0 CS');

    // At 25m: only 1 of 3 games reached 25:00 (2 ended <25m excluded)
    expect(screen.getByTestId('checkpoint-denom-25m')).toHaveTextContent(
      '1/3G reached (n=1) · 2 ended <25m'
    );
    expect(screen.getByTestId('checkpoint-mean-cs-25m')).toHaveTextContent('217.0 CS');

    // At 30m: 0 of 3 games reached 30:00 -> Unavailable (all games ended before mark)
    expect(screen.getByTestId('checkpoint-denom-30m')).toHaveTextContent('0/3G reached 30:00');
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent(
      '0 of 3 sample games reached 30:00 (all 3 ended earlier). Ended games are excluded—never shown as 0 CS.'
    );
  });

  it('defaults to Reference-Only mode and clearly labels optional Demo CS input without fake percentiles or rank claims', () => {
    render(<ProComparisonPreview />);

    // Default is Reference-Only Mode
    expect(screen.getByTestId('mode-status-badge')).toHaveTextContent(
      'Reference-Only Mode (No Live User Data)'
    );
    expect(screen.queryByTestId('demo-cs-input-10m')).not.toBeInTheDocument();

    // Switch to Demo Input Mode
    fireEvent.click(screen.getByTestId('mode-btn-demo-input'));
    expect(screen.getByTestId('mode-status-badge')).toHaveTextContent(
      'Demo Input Mode (Synthetic / Manual Only)'
    );

    const input10m = screen.getByTestId('demo-cs-input-10m');
    fireEvent.change(input10m, { target: { value: '82' } });

    // Top · KSante mean CS@10 is 93.0 -> 82 - 93.0 = -11.0 CS
    expect(screen.getByTestId('demo-delta-10m')).toHaveTextContent('-11.0 CS vs pro sample mean');
    expect(screen.getByTestId('demo-delta-10m')).toHaveTextContent(
      'Synthetic/manual demo input vs 3G pro sample mean (not live player data or rank percentile).'
    );

    // 30m input is disabled and refuses comparison because 30m pro snapshot is unavailable
    const input30m = screen.getByTestId('demo-cs-input-30m') as HTMLInputElement;
    expect(input30m.disabled).toBe(true);

    // Verify evaluateDemoCsComparisons refuses comparison at 30m even if a value is passed programmatically
    const slice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'top',
      championId: 'KSante',
    });
    const evalResult = evaluateDemoCsComparisons(slice, { 30: '250' });
    expect(evalResult[30].canCompare).toBe(false);
    expect(evalResult[30].formattedDelta).toBe('Comparison Unavailable');
  });

  it('surfaces corrected HUD 10:00 VOD URLs (t=3695s and t=6759s), pause heuristic caveats, and makes zero network requests', () => {
    render(<ProComparisonPreview />);

    const caveats = screen.getByTestId('inline-comparison-caveats');
    expect(caveats).toHaveTextContent('8 Worlds 2026 games (80 player-games)');
    expect(caveats).toHaveTextContent('only CS@10 in 2 games');
    expect(caveats).toHaveTextContent('zero-gold freeze heuristic');

    const g1Link = screen.getByTestId('vod-link-ig-tes-g1') as HTMLAnchorElement;
    const g2Link = screen.getByTestId('vod-link-ig-tes-g2') as HTMLAnchorElement;
    expect(g1Link.href).toBe('https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=3695s');
    expect(g2Link.href).toBe('https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=6759s');
    expect(VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095110'].correctedHud10mSeconds).toBe(3695);
    expect(VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095111'].correctedHud10mSeconds).toBe(6759);

    // Expand pause audit panel
    fireEvent.click(screen.getByTestId('btn-toggle-pause-audit'));
    const pausePanel = screen.getByTestId('pause-audit-panel');
    expect(within(pausePanel).getByText(/IG Rookie \(Syndra\)/)).toBeInTheDocument();
    expect(pausePanel).toHaveTextContent('Naive (8:10): 67 CS → True @10:00: 92 CS (+25)');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
