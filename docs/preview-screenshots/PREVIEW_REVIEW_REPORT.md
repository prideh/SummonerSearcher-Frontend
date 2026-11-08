# Pro CS Reference — Streamlined UI Preview Review

## Summary of UX Streamlining

Following the visual review of commit `9de662e`, both the **desktop** and **mobile** views were stripped down to what a player actually needs at a glance:

1. **Main View (Above the Fold)**:
   - **Compact Header**: Shows `Pro CS Reference · Worlds 2026 Sample · 8 Games (80 Player-Games · 53 Pairs · Patch 16.20)`, the mode badge (`Reference Only (No User Data)` or `Demo Input Mode (Not Live User Stats)`), and the `Reference` / `Demo CS Input` toggle. Removed the `"Private"` header badge (since a label does not enforce access control).
   - **Single Filter Bar**: Role pill selector (`All Roles (80G) | Top (16G) | Jungle (16G) | Mid (16G) | Bottom (16G) | Support (16G)`), labeled `Champion` select dropdown, and `Quick Champion Filter` input. Removed duplicate role dropdowns and quick-pair chip rows.
   - **Immediate Checkpoint Grid (`5m / 10m / 15m / 20m / 25m / 30m`)**: Displays mean Total CS (Lane + Jungle), CS/min, min–max range, sample denominator (`reached/totalG`), and an explicit `Unavailable` state at `30m` (`0/totalG (N reached 30m) · Not in 25m sample export`). Removed the extra `14m` pill.
   - **Concise Interpretation Caveat Beside Numbers**: A single 2-line note sits directly beneath the checkpoint cards with the essential interpretation boundaries:
     > **Note:** Small pro reference (8 Worlds 2026 games / 80 player-games, patch 16.20)—not a solo-queue target or percentile. No live user stats connected. Ended games excluded (never 0 CS); 30m not in dataset export. CS@10 HUD-checked in 2/8 games.
2. **On-Demand Disclosures**:
   - **`Match Evidence (NG)`**: Expands the per-game breakdown table (`5m–25m`, `30m Unavailable`, `End CS`, and `10m HUD Check` status with corrected `t=3695s` / `t=6759s` VOD links for IG vs TES G1+G2).
   - **`Methodology & Limits`**: Expands the full verification scope (`53` unique pairs in JSON vs `57` in the prior report heading, partial HUD verification in 2/8 games, zero-gold pause heuristic, Data Dragon `16.22.1` vs tournament `16.20` item mismatch, and the IG vs TES G1 105.02s pause audit table).

## Viewport & Runtime Verification Metrics

| Viewport | `scrollWidth === innerWidth` | Total Page Height (Default View) | Top of `5m` Checkpoint Card | Console / Page Errors | External Network Calls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` (content `470px`) | **`231px`** | `0` | `0` |
| **Mobile (`390×844`)** | `390 === 390` (0 overflow) | `963px` | **`472px`** | `0` | `0` |
| **Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1067px` | **`500px`** (down from `~2500px`) | `0` | `0` |

## Screenshots in Repository (`docs/preview-screenshots/`)

- `pro_comparison_desktop_reference.png`
- `pro_comparison_mobile_390px.png`
- `pro_comparison_mobile_320px.png`
- `pro_comparison_desktop_demo_and_pause_audit.png`
- `pro_comparison_desktop_unsupported_state.png`
- `pro-comparison-standalone-artifact.html` (Self-contained single-file HTML bundle for instant browser review without a server)
