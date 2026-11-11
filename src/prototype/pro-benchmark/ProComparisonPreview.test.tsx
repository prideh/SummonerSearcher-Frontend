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

    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('Top · KSante');
    expect(screen.getByTestId('active-selection-sample-badge')).toHaveTextContent(
      '3G Sample (HLE Zeus, IG TheShy)'
    );

    expect(screen.getByTestId('checkpoint-denom-5m')).toHaveTextContent('3/3G');
    expect(screen.getByTestId('checkpoint-mean-cs-5m')).toHaveTextContent('39.0 CS');

    expect(screen.getByTestId('checkpoint-denom-10m')).toHaveTextContent('3/3G');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('93.0 CS');
    expect(screen.getByTestId('checkpoint-range-cs-10m')).toHaveTextContent('90–98');

    expect(screen.getByTestId('checkpoint-denom-15m')).toHaveTextContent('3/3G');
    expect(screen.getByTestId('checkpoint-mean-cs-15m')).toHaveTextContent('137.3 CS');

    expect(screen.getByTestId('checkpoint-denom-20m')).toHaveTextContent('3/3G');
    expect(screen.getByTestId('checkpoint-mean-cs-20m')).toHaveTextContent('179.7 CS');

    // 25m: (227 + 225 + 217) / 3 = 223.0 CS
    expect(screen.getByTestId('checkpoint-denom-25m')).toHaveTextContent('3/3G');
    expect(screen.getByTestId('checkpoint-mean-cs-25m')).toHaveTextContent('223.0 CS');

    // 30m has 0 exported snapshots in JSON (2 of the 3 KSante games lasted >=30:00)
    expect(screen.getByTestId('checkpoint-denom-30m')).toHaveTextContent('0/3G (2 reached 30m)');
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent('Not available');
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent(
      'Not available at 30m (25m pro sample)'
    );
  });

  it('updates role and champion filters accurately including Jungle total CS', () => {
    render(<ProComparisonPreview />);

    fireEvent.click(screen.getByTestId('role-pill-jungle'));
    fireEvent.change(screen.getByTestId('pro-champion-select'), {
      target: { value: 'ALL' },
    });

    expect(screen.getByTestId('active-selection-title')).toHaveTextContent(
      'Jungle · All Supported Champions in Sample'
    );
    expect(screen.getByTestId('checkpoint-denom-10m')).toHaveTextContent('16/16G');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('78.9 CS');
    expect(screen.getByTestId('checkpoint-mean-cs-15m')).toHaveTextContent('120.2 CS');

    fireEvent.change(screen.getByTestId('pro-champion-select'), {
      target: { value: 'jungle::Qiyana' },
    });
    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('Jungle · Qiyana');
    expect(screen.getByTestId('checkpoint-denom-10m')).toHaveTextContent('2/2G');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('84.0 CS');
  });

  it('handles empty and unsupported champion or role selections honestly without fallback numbers', () => {
    render(<ProComparisonPreview />);

    const searchInput = screen.getByTestId('pro-champion-search');
    fireEvent.change(searchInput, { target: { value: 'Ahri' } });

    expect(screen.getByTestId('unsupported-selection-state')).toBeInTheDocument();
    expect(screen.getByTestId('unsupported-selection-state')).toHaveTextContent(
      '"Ahri" is not among the 53 champion-role matchups in this 8-game (80 player-game) Worlds 2026 pro sample.'
    );
    expect(screen.queryByTestId('checkpoint-cards-grid')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'Syndra' } });
    expect(screen.getByTestId('unsupported-selection-state')).toHaveTextContent(
      'Syndra has 0 games in Top in this 8-game Worlds 2026 sample, but appears in: Mid (3G).'
    );

    fireEvent.click(screen.getByTestId('switch-supported-mid-Syndra'));
    expect(screen.getByTestId('active-selection-title')).toHaveTextContent('Mid · Syndra');
    expect(screen.getByTestId('checkpoint-mean-cs-10m')).toHaveTextContent('96.0 CS');
  });

  it('never substitutes zeros after a game ends and excludes short games from later checkpoint denominators', () => {
    const customDataset: RawProBenchmarkDataset = JSON.parse(
      JSON.stringify(DEFAULT_PRO_BENCHMARK_DATASET)
    );
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

    expect(screen.getByTestId('checkpoint-denom-15m')).toHaveTextContent('3/3G');

    expect(screen.getByTestId('checkpoint-denom-20m')).toHaveTextContent('2/3G (1 ended <20m)');
    expect(screen.getByTestId('checkpoint-short-note-20m')).toHaveTextContent(
      '1 ended <20m excluded (no 0 CS)'
    );
    expect(screen.getByTestId('checkpoint-mean-cs-20m')).toHaveTextContent('178.0 CS');

    expect(screen.getByTestId('checkpoint-denom-25m')).toHaveTextContent('1/3G (2 ended <25m)');
    expect(screen.getByTestId('checkpoint-mean-cs-25m')).toHaveTextContent('217.0 CS');

    expect(screen.getByTestId('checkpoint-denom-30m')).toHaveTextContent('0/3G reached');
    expect(screen.getByTestId('checkpoint-unavailable-30m')).toHaveTextContent(
      '0/3G reached 30:00 (no post-game zeros)'
    );
  });

  it('defaults to Reference-Only mode and clearly labels optional Try a CS value mode without fake percentiles or rank claims', () => {
    render(<ProComparisonPreview />);

    expect(screen.getByTestId('mode-status-badge')).toHaveTextContent(
      'Reference Only (No Account Data)'
    );
    expect(screen.getByTestId('mode-btn-demo-input')).toHaveTextContent('Try a CS value');
    expect(screen.queryByTestId('demo-cs-input-10m')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mode-btn-demo-input'));
    expect(screen.getByTestId('mode-status-badge')).toHaveTextContent(
      'Custom CS Check (Not Account Stats)'
    );

    const input10m = screen.getByTestId('demo-cs-input-10m');
    fireEvent.change(input10m, { target: { value: '82' } });

    expect(screen.getByTestId('demo-delta-10m')).toHaveTextContent('-11.0 CS vs pro');

    const input30m = screen.getByTestId('demo-cs-input-30m') as HTMLInputElement;
    expect(input30m.disabled).toBe(true);

    const slice = computeProComparisonSlice(DEFAULT_PRO_BENCHMARK_DATASET, {
      role: 'top',
      championId: 'KSante',
    });
    const evalResult = evaluateDemoCsComparisons(slice, { 30: '250' });
    expect(evalResult[30].canCompare).toBe(false);
    expect(evalResult[30].formattedDelta).toBe('Not available');
  });

  it('keeps main view focused on essentials and expands per-game evidence and methodology on demand with zero network calls', () => {
    render(<ProComparisonPreview />);

    expect(screen.getByTestId('dataset-scope-strip')).toHaveTextContent(
      '8 Games (80 Player-Games · 53 Matchups · Patch 16.20)'
    );
    expect(screen.queryByTestId('per-game-evidence-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('methodology-disclosure-panel')).not.toBeInTheDocument();

    const caveats = screen.getByTestId('inline-comparison-caveats');
    expect(caveats).toHaveTextContent('8 Worlds 2026 games / 80 player-games, patch 16.20');
    expect(caveats).toHaveTextContent('No live account stats connected');
    expect(caveats).toHaveTextContent('30m pro stats not available');
    expect(caveats).toHaveTextContent('CS@10 HUD-checked in 2/8 games');

    // Expand Per-Game Evidence on demand
    fireEvent.click(screen.getByTestId('btn-toggle-evidence'));
    expect(screen.getByTestId('per-game-evidence-section')).toBeInTheDocument();
    const g1Link = screen.getByTestId('vod-link-ig-tes-g1') as HTMLAnchorElement;
    const g2Link = screen.getByTestId('vod-link-ig-tes-g2') as HTMLAnchorElement;
    expect(g1Link.href).toBe('https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=3695s');
    expect(g2Link.href).toBe('https://www.youtube.com/watch?v=HtgoZzoC4Lo&t=6759s');
    expect(VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095110'].correctedHud10mSeconds).toBe(3695);
    expect(VERIFIED_HUD_10M_VOD_BY_GAME_ID['115660540726095111'].correctedHud10mSeconds).toBe(6759);

    // Expand Methodology & Verification Limits on demand
    fireEvent.click(screen.getByTestId('btn-toggle-methodology'));
    const methodPanel = screen.getByTestId('methodology-disclosure-panel');
    expect(methodPanel).toHaveTextContent('53 unique champion-role matchups in sample');
    expect(methodPanel).toHaveTextContent('passive-gold freeze check');

    const pausePanel = screen.getByTestId('pause-audit-panel');
    expect(within(pausePanel).getByText(/IG Rookie \(Syndra\)/)).toBeInTheDocument();
    expect(pausePanel).toHaveTextContent('67 → 92 CS (+25)');

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
