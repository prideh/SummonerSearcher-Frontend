# Pro CS Comparison — Searched Player Profile Tab & Standalone Preview Review

## 1. Narrow Integration Plan & Backend Memory-Guard Audit

### Where It Lives in the UI
- **Searched Player Profile Tab (`SummonerInfo.tsx`)**: Added an inline profile tab bar (`Profile Overview` | `Pro CS Comparison`) inside the searched player's profile card (`SummonerInfo.tsx`). Top-level navigation (`NavigationLayout.tsx`) and production routes remain untouched.
- **Review Surface (`/?preview=pro-comparison&surface=profile` & `/pro-comparison-preview.html`)**: Opens the Searched Player Profile Tab directly for side-by-side review, with an instant toggle between:
  - **`Searched Player Profile Tab`** (contract review using recorded `MatchDto` + `MatchTimelineDto` payloads for `BladeRunner#EUW` and `ArcaneWave#KR1`, plus a client-side **`Load Local JSON`** inspector for any exported `{ puuid, region, matches, timelines }` bundle),
  - **`Reference`** (standalone 8-game / 80-player-game / 53-pair Worlds 2026 catalog), and
  - **`Demo CS Input`** (clearly labeled manual fallback).

### Existing Data Flow Audit & Why `powerSpikeTimelines` Is Not Used
- **Audited Frontend State**: `SearchPage.tsx` passes `summoner` (`puuid`, `gameName`, `tagLine`), `region`, `matches` (`visibleMatches: MatchDto[]`), and `improvementStats` into `SummonerInfo.tsx`.
- **Audited Backend Endpoints (Read-Only Inspection)**:
  1. `GET /api/riot/timeline/analyze/{region}/{puuid}` (`TimelineController.kt:44` -> `TimelineAnalysisService.analyzeRecentMatches`):
     - Fetches up to **20 match IDs**, loads up to **20 full `MatchTimelineDto` + 20 `MatchDto` payloads concurrently** in memory (`TimelineAnalysisService.kt:64-97`), and computes `powerSpikeTimelines`.
     - **Lossy CS Points (`TimelineAnalysisService.kt:1647-1651`)**: `buildPowerSpikePoints` computes `val minute = ((frame.timestamp ?: 0) / 60000).toInt()` (flooring timestamps without a checkpoint tolerance window) and `val pcs = (playerFrame.minionsKilled ?: 0) + (playerFrame.jungleMinionsKilled ?: 0)` (silently defaulting missing/null counters to `0`).
     - **Incomplete Phase Farming (`TimelineAnalysisService.kt:639-676`)**: `MatchPhaseFarmingDto` only exports `10m`, `20m`, and `End` (omitting `5m`, `15m`, `25m`, `30m`).
     - **Memory Risk**: Because `analyzeTimelines` hydrates up to 20 timelines at once, triggering it automatically for Pro CS comparison would create avoidable heap pressure against the paused production instance (`350 MiB` admission / `360 MiB` stop guard).
  2. `GET /api/riot/timeline/{region}/{matchId}` (`TimelineController.kt:23` -> `TimelineService.getMatchTimeline`):
     - Single-match lookup backed by a **24-hour Redis cache** (`match-timeline:{region}:{matchId}` in `TimelineService.kt:25-39`) returning raw `MatchTimelineDto` frames with timestamped `ParticipantFrameDto.minionsKilled` and `jungleMinionsKilled`.
- **Chosen Bounded Path**:
  - **Zero automatic background/mount requests**: Opening a player profile or switching to the `Pro CS Comparison` tab makes **0** automatic network calls when timelines are already provided or cached, and never calls `analyzeTimelines`.
  - **Bounded On-Demand Single-Match Fetch (`MAX_BOUNDED_TIMELINE_FETCHES = 5`)**: When a live searched player clicks `Load Timelines (up to 5G)` for their selected `(champion, role)` slice, `ProfileProComparisonTab` fetches at most 5 single-match timelines via `getMatchTimeline(region, matchId)` and caches them by `${region}::${matchId}`.
  - **Zero Live Probes / Zero Backend Changes**: No live production or Riot API calls, collector starts, or backend changes were made.

### Strict Extraction & Comparison Contract (`searchedPlayerProAdapter.ts`)
- **Explicit Identity & Participant Mapping**:
  - Resolves the searched player in `MatchDto.info.participants` strictly by `p.puuid === puuid` (never by array index).
  - Resolves the timeline `participantId` in `MatchTimelineDto` strictly via `info.participants[].puuid` and cross-validates `metadata.participants` and the `MatchDto` `participantId`. Mismatched PUUIDs or missing participant mappings are rejected (`'participant_not_found'`).
- **Timestamped Raw Counter Extraction ($\pm 30\text{s}$ Window)**:
  - Evaluates checkpoints at `5m`, `10m`, `15m`, `20m`, `25m`, `30m` using `findTimestampedCheckpointFrame(frames, minute, gameDurationSeconds, 30_000)` (closest frame to `minute * 60_000` within $\pm 30,000\text{ms}$ and `<= (gameDurationSeconds + 30) * 1000`).
  - **Short Games Excluded**: If `gameDurationSeconds < minute * 60`, the checkpoint is marked `'game_ended_before_checkpoint'` (`totalCs: null`) and excluded from the mean denominator—never filled with `0`.
  - **Nullable Counter Guard**: If either `minionsKilled` or `jungleMinionsKilled` is `null`, `undefined`, or non-finite, the checkpoint is marked `'missing_counter'` (`totalCs: null`) and excluded from the mean denominator—never defaulted to `0`.

## 2. Viewport & Runtime Verification Metrics

| Surface & Viewport | `scrollWidth === innerWidth` | Total Page Height | Top of `5m` Checkpoint Card | Console / Page Errors | External Network Calls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Profile Tab — Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` | **`403px`** | `0` | `0` |
| **Profile Tab — Mobile (`390×844`)** | `390 === 390` (0 overflow) | `1660px` | **`874px`** | `0` | `0` |
| **Profile Tab — Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1928px` | **`1072px`** | `0` | `0` |
| **Standalone Reference — Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` | **`263px`** | `0` | `0` |
| **Standalone Reference — Mobile (`390×844`)** | `390 === 390` (0 overflow) | `991px` | **`500px`** | `0` | `0` |
| **Standalone Reference — Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1099px` | **`532px`** | `0` | `0` |

## 3. Screenshots & Standalone Artifact in Repository (`docs/preview-screenshots/`)

- `pro_comparison_profile_tab_desktop.png`
- `pro_comparison_profile_tab_mobile_390px.png`
- `pro_comparison_profile_tab_mobile_320px.png`
- `pro_comparison_profile_tab_unsupported_desktop.png`
- `pro_comparison_desktop_reference.png`
- `pro_comparison_mobile_390px.png`
- `pro_comparison_mobile_320px.png`
- `pro_comparison_desktop_demo_and_pause_audit.png`
- `pro_comparison_desktop_unsupported_state.png`
- `pro-comparison-standalone-artifact.html` (Self-contained single-file HTML bundle for instant browser review without a server)
