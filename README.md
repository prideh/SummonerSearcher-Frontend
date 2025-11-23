http://summonersearcher.com/

# 🏗️ Technical Architecture

The frontend is a **React + TypeScript + Vite** single-page application built with a modern client-side architecture that emphasizes **state isolation**, **predictable data flow**, and **API-driven rendering**.

The application uses the following architectural patterns:

---

## **1. Component-Driven Architecture (React 19)**

The UI is constructed from composable functional components that follow React’s declarative/render-only philosophy. Components are organized into **feature-oriented modules** such as:

* **Match Analysis** (`AnalysisTab`)
* **Graphing / Visual Comparisons** (`GraphsTab`)
* **Navigation Layout**
* **Reusable primitives** (icons, lists, etc.)

Components remain stateless whenever possible; state is externalized into **Zustand stores** to ensure deterministic re-renders and predictable data lifecycles.

---

## **2. Global State Management via Zustand (Flux-like State Store)**

Zustand is used as the central global store for:

* Authentication and JWT persistence (`authStore`)
* Riot static data (items, spells, runes) (`dataDragonStore`)
* Dark mode state
* Cached CDN paths

This follows a **Flux-like one-directional data flow**:

1. UI dispatches actions (e.g., `fetchItemData()`).
2. Store mutates internal state in a predictable, synchronous way.
3. Components re-render based on updated state slices.

This prevents prop drilling, stabilizes derived data, and optimizes re-renders by leveraging Zustand’s shallow comparison.

---

## **3. Service Layer Pattern (API Client Abstraction)**

All backend communication is abstracted behind strongly typed service modules:

* `api/auth.ts`
* `api/user.ts`
* `api/riot.ts`

These modules use a centralized Axios instance (`apiClient`) with:

* **JWT injection through interceptors** 
* **Global error handling** (e.g., auto toast on 429 rate limits)
* **Configurable base URL via Vite environment variables**

This isolates network concerns from UI components and ensures consistent API contract enforcement.

---

## **4. Declarative Routing (React Router v7)**

`BrowserRouter` provides route-based code organization and navigational state management. All authenticated views rely on Zustand’s `authStore` token state; no legacy route guards exist because API endpoints enforce authentication.

---

## **5. Optimized Asset Loading + CDN-Driven Media**

High-volume static assets (champion icons, item icons) are loaded from Riot’s CDN (`ddragon`) using pre-fetched metadata stored in Zustand. This reduces client load, avoids unnecessary backend requests, and accelerates cold starts.

---

## **6. TailwindCSS Utility-First Styling**

Styling follows a utility-first, atomic class pattern with:

* Responsive and dark-mode variants
* Zero runtime CSS generation
* Theme initialization in `main.tsx` based on persisted preferences 

---

## **7. Algorithmic Logic & Data Processing**

Even though the app is primarily UI-bound, several components implement non-trivial domain logic:

### **AnalysisTab**

* Derives lane opponent by comparing team + lane roles
* Normalizes “challenges” maps by filtering null/zero values
* Computes stat “wins” for side-by-side comparison

### **GraphsTab**

* Sorts players by dynamic metrics
* Computes proportional bar widths based on the maximum stat
* Uses reusable `StatGraph` abstraction for dozens of metric types

This logic is encapsulated directly inside components for transparency and performance, avoiding global state contamination.

---

# 🔄 How It Works

This describes the complete data flow between **user → frontend → backend → Riot API** and how UI state evolves over time.

---

## **1. Application Boot Phase**

When the app loads:

1. `main.tsx` initializes the theme from localStorage.
2. Zustand stores are created.
3. `App.tsx` triggers prefetching of static assets:

   * Items
   * Summoner spells
   * Rune trees
     These are cached in-memory to avoid repeated CDN calls.

---

## **2. Authentication Flow**

All authentication flows rely on the shared Axios instance, which automatically adds JWTs via an interceptor .

### **Login (with or without 2FA)**

1. User submits email/password → `loginUser()`.
2. Backend may return:

   * `jwt` (normal login)
   * or `{ twoFactorRequired: true, tempToken }`
3. If 2FA is required:

   * User enters TOTP code → `verify2FALogin(tempToken, code)`
   * Final JWT is returned.

### **State updates:**

* `authStore` persists JWT and dark mode preferences.
* Recent search history is hydrated into the store.

---

## **3. Summoner Search Flow**

When a user searches for a summoner:

1. Component calls `getSummonerByName(region, name, tag)`.
2. Axios client attaches JWT.
3. Backend fetches via Riot API (PUUID → Summoner → Matchlist → Matches).
4. Frontend receives a large `SummonerProfile` object containing:

   * Basic profile
   * Rank info
   * 10–20 match details
   * Role metadata

### **Frontend processing:**

* Match details populate components like:

  * Overview
  * `AnalysisTab`
  * `GraphsTab`

These components derive opponent relationships, compute challenge highlights, and generate horizontal graph bars.

---

## **4. Match Analysis Algorithms**

### **AnalysisTab**

* Locates the “main player” by `puuid`.
* Identifies their lane opponent by:

  ```
  teamPosition matches AND teamId differs
  ```
* Extracts challenge metrics and:

  * Filters invalid metrics
  * Normalizes values
  * Renders “wins” with green highlighting

### **GraphsTab**

* Configurable graph type determines stat selector
* All participants sorted by selected stat
* Calculates max value for percent scaling
* Builds team-colored gradient bars with dynamic width

This entire system is designed for:

* O(n log n) stat sorting
* O(n) challenge comparison
* Smooth rendering for large match histories

---

## **5. User Settings & Recent Searches**

Authenticated users can:

* Toggle 2FA
* Change password
* Modify dark mode (persisted to DB)
* Load or clear recent searches

All these actions:

* Hit `/api/user/**` endpoints
* Update Zustand `authStore` state
* Influence UI layout/theme

---

## **6. Deployment Architecture (Frontend)**

### Local

* Vite dev server (HMR)
* Backend on separate port (proxied via nginx in production)

### Production

* React built into static assets (ESM)
* Served by NGINX with fallback routing (`try_files`) 
* `/api/**` is proxied to the backend container
* Hosted on Render, with a domain purchased from Cloudflare. http://summonersearcher.com/

This ensures SPA routing works without server intervention.

✅ A full rewritten README including backend + frontend
Just tell me what format you want.
