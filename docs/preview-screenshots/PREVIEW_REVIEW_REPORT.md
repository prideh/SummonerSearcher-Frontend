# Pro CS Comparison — Searched Player Profile Tab & Standalone Preview Review

## 1. Async Identity Bug Fix (`ProfileProComparisonTab.tsx`)

- **Root Cause Fixed**: Previously, `handleLoadTimelinesForSelectedPair` captured `const requestIdentityKey = identityKey` and after `await fetchTimeline(...)` compared `requestIdentityKey === "${region.toLowerCase()}::${puuid}"` using `region` and `puuid` from the **same** render closure (which was always `true`). Switching the searched player while a timeline request was in flight could leak stale completion data, loading spinners, or error banners onto the newly displayed player.
- **Ref + Generation + Scoped State Fix**:
  1. Added `isMountedRef`, `activeIdentityKeyRef`, and `requestGenerationRef` in `src/prototype/pro-benchmark/ProfileProComparisonTab.tsx`.
  2. Incremented `requestGenerationRef.current` and updated `activeIdentityKeyRef.current` whenever `identityKey` (`${region.toLowerCase()}::${puuid}`) changes, when `selectedPairKey` changes, and on component unmount.
  3. Scoped all per-player UI state (`selectedPairKey`, `selectedMatchId`, `loadedTimelines`, `loadingTimelines`, `timelineFetchError`, `surfaceMode`, `showMatchBreakdown`) inside `PlayerScopedUiState` tagged with `identityKey`, so switching from Player A to Player B immediately renders clean state (`loadingTimelines = false`, `timelineFetchError = null`, `loadedTimelines = {}`) with zero 1-frame leak and zero automatic fetches.
  4. Guarded `handleLoadTimelinesForSelectedPair` with `isRequestCurrent()` (`isMountedRef.current && activeIdentityKeyRef.current === requestIdentityKey && requestGenerationRef.current === requestGeneration`) before and after every `await fetchTimeline(...)` call, before writing `sharedTimelineCache` or state, and inside `finally`.
  5. Removed the speculative `'paused by memory guard'` sentence from `timelineFetchError`, replacing it with factual wording: `Could not load ${failedCount} of ${matchIdsToFetch.length} match timeline(s) from the timeline endpoint.`
  6. Added 3 delayed-request tests in `src/prototype/pro-benchmark/searchedPlayerProAdapter.test.tsx` covering:
     - Delayed Player A request resolving **after** Player B is displayed (and verifying batch short-circuit, cache isolation, and A -> B -> A generation invalidation).
     - Delayed Player A request rejecting while Player B has its own timeline load in flight (verifying error and `loadingTimelines` isolation).
     - Unmount invalidation while a batch timeline request is in flight + factual non-speculative error messaging.

## 2. Data-Path Status, `TimelineService` Audit, & Blockers

1. **`recordedPlayerContractSample.ts` Is Synthetic (`Synthetic test profile / Not real player data`)**:
   - The preview profiles (`BladeRunner#EUW` and `ArcaneWave#KR1`) in `src/prototype/pro-benchmark/recordedPlayerContractSample.ts` are **synthetic test fixtures** with fabricated PUUIDs (`puuid-synthetic-euw-top-001`, `puuid-synthetic-kr-mid-002`), profile/rank metadata, match IDs, gold/XP, and timeline frames constructed to exercise the `MatchDto` + `MatchTimelineDto` TypeScript contract.
   - No genuine untruncated Riot `MatchDto` + `MatchTimelineDto` player snapshot exists in either repository (`SummonerSearcher-Backend/agurin.json` is a 956-character truncated PowerShell `Invoke-WebRequest` summary; `improvement-stats-contract.json` is an `ImprovementStatsDto` aggregate output fixture). No fabricated "recorded" snapshot is claimed.
2. **Exact Data-Path Limitation**:
   - **Standalone Preview (`pro-comparison-preview.html` / `/?preview=pro-comparison&surface=profile`)**: Operates strictly on **synthetic test profiles** (`Synthetic test profile / Not real player data`) or user-pasted **client-side local JSON** (`Review Controls` -> `Load Local JSON`). Zero network requests are made.
   - **In-App Searched Player Integration (`SearchPage.tsx` -> `SummonerInfo.tsx` -> `ProfileProComparisonTab.tsx`)**: Actual PUUID, region, `visibleMatches` (`MatchDto[]`), and explicit on-demand `getMatchTimeline(region, matchId)` wiring is implemented in code and tested in unit/component suites (`130/130` tests passing), **but live runtime calls against the backend / Riot API remain unverified**.
3. **Backend `TimelineService.kt` Audit (Why `GET /api/riot/timeline/{region}/{matchId}` Is Not Cache-Only / Inert)**:
   - In `SummonerSearcher-Backend` (`TimelineService.kt:30-58`), `getTimeline(matchId, region)` checks `redisCacheService.get("timeline:${region.lowercase()}:$matchId", MatchTimelineDto::class.java)`.
   - However, it calls live `riotApiService.getMatchTimeline(matchId, region)` on **either**:
     1. A Redis cache miss (`cached == null`), **OR**
     2. A cached entry where `needsTimelineBackfill(cached)` is `true` (`frames == null`, or `CHAMPION_KILL` events exist and all have `bounty == null && shutdownBounty == null`).
   - Therefore, `GET /api/riot/timeline/{region}/{matchId}` is **not** inert/cache-only.
   - Meanwhile, `GET /api/riot/timeline/analyze/{region}/{puuid}` (`TimelineController.kt:44-82`) fans out up to **20** concurrent `timelineService.getTimelines(matchIds, region, 20)` calls (each subject to cache miss or legacy bounty backfill) and runs full `timelineAnalysisService.analyze(...)`. `ProfileProComparisonTab` never calls `analyzeTimelines`.
4. **Current Auth / CORS / Memory-Guard Blockers & Smallest Safe Real-Data Review Path**:
   - **Memory Guard Blocker**: Pinned production is under the `350 MiB` admission / `360 MiB` stop guard; no live production calls or Riot API triggers are permitted from this environment.
   - **Auth vs. Browser CORS (`apiClient.ts` & `SecurityConfig.kt`)**: `.requestMatchers("/api/riot/**").permitAll()` requires no user JWT, but `apiClient.ts` sets `withCredentials: true` against `VITE_API_BASE_URL/api`, which requires the frontend origin to match `cors.allowed-origins` (`http://localhost:5173` locally).
   - **Smallest Safe Path for Real-Data Verification**:
     - **Path A — Zero-Backend Genuine Snapshot Import (0 MiB backend impact, 0 Riot calls)**: Export 1 genuine `MatchDto` + 1 `MatchTimelineDto` JSON snapshot outside the paused production container into `{"puuid":"...","region":"EUW1","gameName":"...","tagLine":"...","visibleMatches":[...],"timelinesByMatchId":{"...":...}}` and load it via `Review Controls` -> `Load Local JSON`.
     - **Path B — Bounded 1-Match Local Memory-Reviewed Path**: Against a local/staging backend with memory headroom monitored (`http://localhost:5173` -> `http://localhost:8080`), search 1 real Riot ID, open `Pro CS Comparison`, select **1 specific match (`1G`)** in `Match Scope` (bounding `unloadedMatchIdsForSelectedPair` to `1` match ID), and click `Load Timelines (1G)`—issuing at most **1** `GET /api/riot/timeline/{region}/{matchId}` request and avoiding the 20-match `analyzeTimelines` fan-out.

## 3. Viewport & Runtime Verification Metrics

| Surface & Viewport | `scrollWidth === innerWidth` | Total Page Height | Top of `5m` Checkpoint Card | Console / Page Errors | External Network Calls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Profile Tab — Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` | **`151px`** (down from `403px`) | `0` | `0` |
| **Profile Tab — Mobile (`390×844`)** | `390 === 390` (0 overflow) | `1019px` | **`280px`** (down from `874px`; beats `b247`'s `472px`) | `0` | `0` |
| **Profile Tab — Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1069px` | **`315px`** (down from `1072px`; beats `b247`'s `500px`) | `0` | `0` |
| **Standalone Reference — Desktop (`1280×900`)** | `1280 === 1280` (0 overflow) | `900px` | **`259px`** | `0` | `0` |
| **Standalone Reference — Mobile (`390×844`)** | `390 === 390` (0 overflow) | `957px` | **`468px`** | `0` | `0` |
| **Standalone Reference — Mobile (`320×568`)** | `320 === 320` (0 overflow) | `1093px` | **`528px`** | `0` | `0` |
