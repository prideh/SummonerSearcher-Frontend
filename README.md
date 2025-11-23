# 🔍 Summoner Searcher

[![Live Site](https://img.shields.io/badge/Live_Site-summonersearcher.com-3b82f6?style=for-the-badge&logo=google-chrome&logoColor=white)](http://summonersearcher.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-443E38?style=for-the-badge&logo=react&logoColor=white)](https://github.com/pmndrs/zustand)

Summoner Searcher is a comprehensive League of Legends player analysis tool.

---

## 📸 Gallery

### Desktop View
<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/85b47f13-1e00-4a4b-ba66-c4697507c92a" alt="Desktop 1" width="100%">
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/49eee0b7-527a-4e4d-8ef8-c901ee48f45c" alt="Desktop 2" width="100%">
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/3815449c-aeb7-4a9c-8987-29e9f9ee0a3f" alt="Desktop 3" width="100%">
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/c4863683-b854-4427-986d-7cc163d33bc3" alt="Desktop 4" width="100%">
    </td>
  </tr>
</table>

### Mobile View
<table>
  <tr>
    <td align="center"><img src="https://github.com/user-attachments/assets/08637f6b-67fd-4bb8-8d6b-b0a5e2ae0a8d" alt="Mobile 1"></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/19e3b0fd-3b50-4261-bdfa-a98ece1f1b06" alt="Mobile 2"></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/cb676f58-53d6-493f-a4b4-8ce0d2d0d3b3" alt="Mobile 3"></td>
    <td align="center"><img src="https://github.com/user-attachments/assets/36cc4333-4523-42b1-9698-7ac97fd0fd54" alt="Mobile 4"></td>
  </tr>
</table>

---

## 🏗️ Technical Architecture

The frontend is a **React + TypeScript + Vite** single-page application built with a modern client-side architecture that emphasizes **state isolation**, **predictable data flow**, and **API-driven rendering**.

The application uses the following architectural patterns:

### 1. Component-Driven Architecture (React 19)
The UI is constructed from composable functional components that follow React’s declarative/render-only philosophy. Components are organized into **feature-oriented modules** such as:
* **Match Analysis** (`AnalysisTab`)
* **Graphing / Visual Comparisons** (`GraphsTab`)
* **Navigation Layout**
* **Reusable primitives** (icons, lists, etc.)

Components remain stateless whenever possible; state is externalized into **Zustand stores** to ensure deterministic re-renders and predictable data lifecycles.

### 2. Global State Management via Zustand
Zustand is used as the central global store for:
* Authentication and JWT persistence (`authStore`)
* Riot static data (items, spells, runes) (`dataDragonStore`)
* Dark mode state
* Cached CDN paths

This follows a **Flux-like one-directional data flow**:
1. UI dispatches actions (e.g., `fetchItemData()`).
2. Store mutates internal state in a predictable, synchronous way.
3. Components re-render based on updated state slices.

### 3. Service Layer Pattern (API Client Abstraction)
All backend communication is abstracted behind strongly typed service modules (`api/auth.ts`, `api/user.ts`, `api/riot.ts`). These modules use a centralized Axios instance (`apiClient`) with:
* **JWT injection through interceptors**
* **Global error handling** (e.g., auto toast on 429 rate limits)
* **Configurable base URL via Vite environment variables**

### 4. Declarative Routing (React Router v7)
`BrowserRouter` provides route-based code organization. All authenticated views rely on Zustand’s `authStore` token state; no legacy route guards exist because API endpoints enforce authentication.

### 5. Optimized Asset Loading + CDN-Driven Media
High-volume static assets (champion icons, item icons) are loaded from Riot’s CDN (`ddragon`) using pre-fetched metadata stored in Zustand. This reduces client load and accelerates cold starts.

### 6. TailwindCSS Utility-First Styling
Styling follows a utility-first, atomic class pattern with responsive/dark-mode variants and zero runtime CSS generation.

### 7. Algorithmic Logic & Data Processing
Even though the app is primarily UI-bound, several components implement non-trivial domain logic:
* **AnalysisTab:** Derives lane opponent by comparing team + lane roles, normalizes “challenges” maps, and computes stat “wins”.
* **GraphsTab:** Sorts players by dynamic metrics, computes proportional bar widths, and uses reusable `StatGraph` abstractions.

---

## 🔄 How It Works

This describes the complete data flow between **user → frontend → backend → Riot API**.

### 1. Application Boot Phase
1. `main.tsx` initializes the theme from localStorage.
2. Zustand stores are created.
3. `App.tsx` triggers prefetching of static assets (Items, Spells, Runes) into memory.

### 2. Authentication Flow
All authentication flows rely on the shared Axios instance.
* **Login:** User submits credentials → Backend returns `jwt` or triggers 2FA flow (`verify2FALogin`).
* **State:** `authStore` persists JWT and dark mode preferences.

### 3. Summoner Search Flow
1. Component calls `getSummonerByName`.
2. Backend fetches via Riot API (PUUID → Summoner → Matchlist → Matches).
3. Frontend receives a large `SummonerProfile` object.
4. Match details populate components like `AnalysisTab` and `GraphsTab`.

### 4. Match Analysis Algorithms
* **AnalysisTab:** Locates the “main player” by `puuid` and identifies their lane opponent.
* **GraphsTab:** Configurable graph type determines stat selector; uses O(n log n) sorting and builds team-colored gradient bars.

### 5. User Settings & Recent Searches
Authenticated users can toggle 2FA, change passwords, or modify dark mode. These actions hit `/api/user/**` endpoints and update Zustand state.

---

## 🚀 Deployment

* **Local:** Vite dev server (HMR).
* **Production:** React built into static assets (ESM), served by NGINX with fallback routing (`try_files`), hosted on Render.
