# AGENTS.md — Agent & Contributor Directives for Project Subterfuge

Welcome to **Project Subterfuge**. This repository contains a complete, production-grade, asynchronous social deduction web application inspired by Cold War espionage and party games like Jackbox Games, Among Us, and Codenames.

This document serves as the primary technical onboarding guide and operational standard for autonomous agents, pair-programming assistants, and human engineers contributing to the codebase.

---

## 1. Project Overview & Architecture

### 1.1 Tech Stack
- **Framework:** Next.js 14 (App Router, React Server Components + Client Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS with custom thematic extensions (`classified-amber`, `classified-crimson`, `classified-terminal`, `carbon-*` palette)
- **Icons:** `lucide-react`
- **Testing:** Playwright E2E Test Suite (multi-context concurrent client testing)
- **Storage:** In-memory game state store with JSON file persistence fallback (`src/lib/store/game-store.ts`)

### 1.2 Directory Layout
```
subterfuge2/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── rooms/                      # REST endpoints for room lifecycle & actions
│   │   │       ├── route.ts                # POST /api/rooms (create room)
│   │   │       └── [code]/
│   │   │           ├── join/route.ts       # POST join room
│   │   │           ├── ready/route.ts      # POST declare readiness
│   │   │           ├── start/route.ts      # POST commence infiltration (host only)
│   │   │           ├── state/route.ts      # GET client-sanitized game state
│   │   │           ├── messages/route.ts   # GET/POST public, team, and DM comms
│   │   │           ├── messages/burn/route.ts # POST shred 1-on-1 DM history
│   │   │           ├── mole/challenge/route.ts # POST mole clearance challenge
│   │   │           ├── mole/respond/route.ts   # POST mole challenge response
│   │   │           ├── verdict/suggest/route.ts# POST nominate candidate word
│   │   │           ├── verdict/vote/route.ts   # POST upvote candidate word
│   │   │           ├── verdict/submit/route.ts # POST lock in verdict (spymaster only)
│   │   │           └── rematch/route.ts    # POST reset room to lobby (host only)
│   │   ├── room/
│   │   │   └── [code]/
│   │   │       └── page.tsx                # Unified client interface (Lobby, Infiltration, Verdict, Debrief)
│   │   ├── layout.tsx                      # Root layout, metadata & CRT scanline aesthetic
│   │   ├── globals.css                     # Global styles, scanline animations, thematic utilities
│   │   └── page.tsx                        # Home page: Create Operation / Access Channel
│   └── lib/
│       ├── store/
│       │   └── game-store.ts               # Core game engine, room manager, scoring & persistence
│       └── types/
│           └── game.ts                     # TypeScript data models, state contracts & enums
├── tests/
│   ├── harness/
│   │   └── multiplayer-harness.ts          # Multi-context Playwright test utility
│   └── e2e/
│       ├── slice1-harness.spec.ts          # Lobby sync & roster readiness
│       ├── slice2-deployment.spec.ts       # Role & theme assignment matrix
│       ├── slice3-communication.spec.ts    # Public, Team, and DM comms + burn
│       ├── slice4-mole-protocol.spec.ts    # Ephemeral mole verification handshake
│       ├── slice5-theme-declass.spec.ts    # 50% midpoint theme broadcast
│       ├── slice6-verdict-scoring.spec.ts  # Verdict deliberation, spymaster lock-in & +1/0 scoring
│       ├── slice7-full-game.spec.ts        # End-to-end operational loop + rematch
│       ├── slice8-field-manual.spec.ts     # In-game operational field manual
│       ├── slice9-multi-session-and-direct-join.spec.ts # Tab isolation & in-page onboarding
│       ├── slice10-recovery-link.spec.ts   # Personal recovery links & reconnect portal
│       ├── slice11-lobby-management-and-sanitization.spec.ts # Host kick, leave & input bounds
│       └── slice12-mobile-audit.spec.ts    # iOS Safari (WebKit) & Android Chrome (Chromium) audit
└── screenshots/                            # Visual regression artifacts (verified in walkthrough.md)
```

---

## 2. Core Game Rules & Behavioral Contracts

Before modifying game logic, agents must understand the core rules:

1. **Player Count & Balancing:**
   - Rooms strictly require an **even number of operatives** ($N \in \{4, 6, 8, 10, 12\}$).
   - Evenly divided into apparent **Red Team** ($N/2$) and apparent **Blue Team** ($N/2$).
2. **Role Distribution:**
   - **Spymaster:** Exactly 1 per team. Holds exclusive authority to submit final verdict guesses.
   - **Embedded Mole:** Exactly 1 per team (2 per team at 12 players). Assigned apparent cover on Team A, but secret true loyalty to Team B.
   - **Field Agents:** Remaining operatives.
3. **Thematic Codebook & Midpoint Intercept:**
   - All assigned words share a single global theme (e.g. `"Dance"`: `BALLET`, `TANGO`, `WALTZ`, `STEP`).
   - Words are masked behind a **"Hold to Decrypt"** interaction to prevent shoulder-surfing.
   - At exactly 50% elapsed mission time, the system broadcasts the operational theme to all operatives.
4. **Mole Verification Protocol (Screen-Share Safe):**
   - Spymasters can issue a covert clearance challenge in 1-on-1 DMs.
   - Genuine moles see a 3-second self-destruct toast (`"Operative Verified"`) with zero persistent UI traces.
   - The Spymaster receives a persistent cryptographic receipt (`CONFIRMED ASSET`).
5. **Verdict & Scoring:**
   - Spymasters lock in guesses for all $N$ words and optionally indict an enemy mole.
   - Correct Word: $+1$ PT. Wrong Word: $0$ PTS (no penalty).
   - Correct Mole Indictment: $+2$ PTS (used as a decisive tiebreaker).
   - **Mole Win Condition:** Moles win if and only if their *actual* team wins.
6. **Rematch Loop:**
   - In `DEBRIEF`, the Host can click **"Commence Rematch // Return to Lobby"** to reset the room state, shuffle roles and codebook, and keep all players connected in the lobby.

---

## 3. Strict Security & Information Redaction Principles

> [!CAUTION]
> **Data Leakage Prohibition:** Client applications must NEVER receive unredacted secret data from the server before official declassification.

When writing or modifying API routes and state serializations:
1. **`getClientGameState(code, sessionToken)` is the Single Source of Truth for Client Sanitization:**
   - A player must only receive their *own* assigned word, role, and true allegiance.
   - Opponents' words, roles, and true teams must be scrubbed (`undefined`) in `players[]` until `DEBRIEF`.
   - The master `codebook` must be omitted until `DEBRIEF`.
   - The primary `selectedTheme` must remain hidden until the 50% midpoint timestamp has passed.
2. **Channel Isolation for Messages:**
   - `GET /api/rooms/[code]/messages` must strictly filter:
     - `PUBLIC`: readable by everyone.
     - `TEAM_RED` / `TEAM_BLUE`: readable only by players whose `apparentTeam` matches.
     - `DM`: readable only by the sender and recipient.
3. **Screen-Share Safety:**
   - Secret words must default to `REDACTED` in the DOM and only decrypt while the user holds the decrypt button.
   - Mole verification toasts must expire and clean up automatically.
   - Personal recovery links (`?token=...`) must be stripped from the browser address bar immediately via `window.history.replaceState`.

---

## 4. Multi-Session, Tab Isolation & Session Recovery Architecture

Project Subterfuge uses a specialized hybrid session architecture (Option C - Jackbox / Among Us pattern):

1. **Tab Isolation in Lobby (`sessionStorage`):**
   - Each browser tab maintains its own operative session in `sessionStorage.getItem('subterfuge_session_' + code)`.
   - This allows developers and players on the same machine to test multiple operatives across tabs or windows without session collisions.
   - **Never auto-assume a previous session in `LOBBY` without user consent.** Instead, display `#saved-session-alert` with `#resume-saved-session-btn` alongside `#join-operation-form`.
2. **Mobile Device Auto-Resume (`localStorage`):**
   - On mobile devices, background tabs are frequently suspended or evicted by OS memory management.
   - Tokens are mirrored to `localStorage.getItem('subterfuge_session_' + code)`.
   - In active gameplay phases (`INFILTRATION`, `VERDICT`, `DEBRIEF`), if `sessionStorage` is empty, the client automatically falls back to `localStorage` and restores the operative station without requiring re-entry.
3. **Personal Recovery Links (`/room/[code]?token=[SECRET_TOKEN]`):**
   - Operatives can click `#copy-personal-link-btn` (`"MY RECOVERY LINK"`) at any time to copy their private recovery URL.
   - Navigating to this URL in any browser or device immediately logs into their station and scrubs `?token=` from the address bar.
4. **Mid-Game Recovery Portal (`#reconnect-operation-card`):**
   - Direct lobby onboarding is closed once `INFILTRATION` begins.
   - Visiting `/room/[code]` without credentials displays the Recovery Portal with `#recovery-token-input` and `#resume-station-btn`.
5. **Callsign De-Duplication:**
   - Attempting to join an active lobby with an existing callsign rejects with `OPERATIVE_EXISTS` and guides the user to their recovery token.

---

## 5. Development & Testing Directives

### 5.1 Verification Standard
Every change to the codebase **must** be validated by running the build and test suites:

```bash
# 1. Verify TypeScript compilation and ESLint
npm run build

# 2. Run single test suite
npx playwright test tests/e2e/slice10-recovery-link.spec.ts

# 3. Run full regression suite (all 10 slices)
npx playwright test
```

### 5.2 Test Writing Guidelines
- When authoring new tests, utilize `browser.newContext()` to simulate independent devices and tabs.
- Always grant clipboard permissions when testing copy buttons:
  ```ts
  const context = await browser.newContext({
    permissions: ["clipboard-read", "clipboard-write"],
  });
  ```
- Use resilient locators (IDs such as `#start-operation-btn`, `#toggle-ready-btn`, `#copy-personal-link-btn`).
- When asserting on text that may appear in both header and roster (e.g. operative callsign), disambiguate using `.first()` or specific container scopes:
  ```ts
  await expect(page.getByText("Commander-Alpha").first()).toBeVisible();
  ```

---

## 6. Visual Design System & Styling Conventions

Project Subterfuge enforces a strict Cold War intelligence aesthetic:
- **Colors:**
  - Backgrounds: `bg-carbon-950` (primary), `bg-carbon-900` (cards), `bg-carbon-850` (subtle hover).
  - Borders: `border-carbon-800` (subtle), `border-carbon-700` (dossiers).
  - Accents: `text-classified-amber` (classified intel), `text-classified-crimson` (top secret / red faction), `text-classified-terminal` (green phosphor / verified), `text-classified-intelBlue` (blue faction).
- **Typography:** Monospace fonts (`font-mono`) everywhere with wide letter-spacing (`tracking-wider`, `tracking-widest`) and uppercase labels.
- **Visual Elements:** Classified stamps (`classified-stamp`), CRT scanline animation (`crt-scanline`), teletype styling, and badge indicators.
- **Icons:** Standardized on `lucide-react` (e.g. `Radio`, `Terminal`, `Lock`, `ShieldCheck`, `Flame`, `BookOpen`, `KeyRound`).

---

## 7. Operational Etiquette for Agents

1. **Do Not Break Passing Tests:** All 10 existing Playwright suites must remain 100% green.
2. **Preserve Comments & Docstrings:** Do not remove existing explanatory comments when modifying files.
3. **Follow Planning Mode:** For non-trivial architectural changes, formulate an implementation plan, obtain user alignment, execute carefully, and update `walkthrough.md`.
4. **Keep Commits Clean & Verbose:** Commit with descriptive titles (e.g. `feat(subsystem): brief summary`) and document key decisions.
