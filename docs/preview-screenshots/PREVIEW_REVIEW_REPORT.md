# Pro CS Comparison — Searched Player Profile Tab & Standalone Preview Review

## 1. Data-Path Status: Synthetic Test Profiles vs. In-App PUUID Wiring (Unverified Live)

1. **`recordedPlayerContractSample.ts` Is Synthetic (`Synthetic test profile / Not real player data`)**:
   - The preview profiles (`BladeRunner#EUW` and `ArcaneWave#KR1`) in `src/prototype/pro-benchmark/recordedPlayerContractSample.ts` are **synthetic test fixtures** with fabricated PUUIDs (`puuid-synthetic-euw-top-001`, `puuid-synthetic-kr-mid-002`), profile/rank metadata, match IDs, gold/XP, and timeline frames constructed to exercise the `MatchDto` + `MatchTimelineDto` TypeScript contract and edge cases (non-index PUUID mapping, short 23:00 game, `30m` unavailable in pro export, and unsupported `Garen · Top`).
   - They are **not** real Riot accounts or recorded production payloads, and are visibly badged **`Synthetic test profile / Not real player data`** in the UI.
2. **Exact Data-Path Limitation**:
   - **Standalone Preview (`pro-comparison-preview.html` / `/?preview=pro-comparison&surface=profile`)**: Operates strictly on **synthetic test profiles** or user-pasted **client-side local JSON** (`Review Controls` -> `Load Local JSON`). Zero network requests are made.
   - **In-App Searched Player Integration (`SearchPage.tsx` -> `SummonerInfo.tsx` -> `ProfileProComparisonTab.tsx`)**: Actual PUUID, region, `visibleMatches` (`MatchDto[]`), and on-demand `getMatchTimeline(region, matchId)` wiring is implemented in code, **but live runtime calls against the backend / Riot API are unverified**.
3. **Current Auth / CORS / Memory-Guard Blockers**:
   - **Memory Guard Blocker**: Pinned production is paused under the `350 MiB` admission / `360 MiB` stop guard, and no live production requests, restarts, or Riot API probes are authorized.
   - **Frontend `apiClient` + Backend CORS (`apiClient.ts` & `SecurityConfig.kt`)**:
     - Backend `SecurityConfig.kt:60` configures `.requestMatchers("/api/riot/**").permitAll()`, so `/api/riot/summoner/{region}/{gameName}/{tagLine}` and `/api/riot/timeline/{region}/{matchId}` do **not** require a logged-in user JWT.
     - However, frontend `apiClient.ts:9-12` requires `VITE_API_BASE_URL` and sets `withCredentials: true`, while backend `SecurityConfig.kt:34,104-119` restricts `Access-Control-Allow-Origin` to `cors.allowed-origins` (`http://localhost:5173` locally). Any preview origin not listed in `cors.allowed-origins` is blocked by browser CORS when `withCredentials: true` is sent.
4. **Smallest Safe Path for Real-Data Review (Zero Production Risk)**:
   - **Path A — Zero-Backend Offline Real-JSON Inspection (0 MiB backend heap)**: Export 1 real cached `MatchDto` + 1 `MatchTimelineDto` JSON payload (from a local dev cache or saved Riot `match-v5` response) into `{"puuid":"...","region":"EUW1","gameName":"...","tagLine":"...","visibleMatches":[...],"timelinesByMatchId":{"...":...}}` and paste it into `Review Controls` -> `Load Local JSON` (100% in-browser).
   - **Path B — Local Single-Match Timeline Verification (1 match = 1 timeline call)**: Against a local dev backend (`VITE_API_BASE_URL=http://localhost:8080`, `cors.allowed-origins=http://localhost:5173`), search 1 real Riot ID, open the `Pro CS Comparison` tab inside `SummonerInfo`, select **1 specific match** in `Match Scope` (which scopes `unloadedMatchIdsForSelectedPair` to `1G`), and click `Load Timelines (1G)`—issuing exactly **1** `GET /api/riot/timeline/{region}/{matchId}` request (24h Redis TTL) and never calling the 20-match `analyzeTimelines` endpoint.

## 2. Viewport & Runtime Verification Metrics

| Surface & Viewport | `scrollWidth === innerWidth` | Total Page Height | Top of `5m` Checkpoint Card | Console / Page Errors | External Network Calls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Profile Tab — Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` | **`151px`** (down from `403px`) | `0` | `0` |
| **Profile Tab — Mobile (`390×844`)** | `390 === 390` (0 overflow) | `1019px` | **`280px`** (down from `874px`; beats `b247`'s `472px`) | `0` | `0` |
| **Profile Tab — Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1069px` | **`315px`** (down from `1072px`; beats `b247`'s `500px`) | `0` | `0` |
| **Standalone Reference — Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` | **`259px`** | `0` | `0` |
| **Standalone Reference — Mobile (`390×844`)** | `390 === 390` (0 overflow) | `957px` | **`468px`** | `0` | `0` |
| **Standalone Reference — Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1093px` | **`528px`** | `0` | `0` |

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
