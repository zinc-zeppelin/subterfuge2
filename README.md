# 🕵️‍♂️ PROJECT SUBTERFUGE

> **TOP SECRET // EYES ONLY // DISAVOW IF CAPTURED**  
> An asynchronous, mobile-first social deduction web game of Cold War espionage, mole infiltration, and cryptographic codebooks.

[![Live Site](https://img.shields.io/badge/play-playsubterfuge.com-ff4655?style=flat-square&logo=radar)](https://playsubterfuge.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15_(App_Router)-000000?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Vitest-124%20passed-22c55e?style=flat-square&logo=vitest)](https://vitest.dev/)
[![E2E](https://img.shields.io/badge/Playwright-8%20domain%20suites-45ba4b?style=flat-square&logo=playwright)](https://playwright.dev/)

---

## 1. What is Project Subterfuge?

**Project Subterfuge** is a social deduction game designed for parties, remote game nights, Discord communities, and office play. Inspired by party classics like *Codenames*, *Among Us*, *Town of Salem*, and *Jackbox Games*, Subterfuge blends word association, secret identity deduction, and real-time counter-intelligence into a high-tension espionage terminal.

Operatives join a secure channel on their phones or browsers (no app store downloads required), receive top-secret code words, and spend anywhere from **1 to 24 hours** (default: 12 hours) communicating across public wires, encrypted radios, and private back-channels. Two rival factions race to deduce the enemy code words while rooting out embedded enemy moles planted inside their own squad.

### Key Highlights
- **Play Anywhere, Anytime (Asynchronous or Live):** Configurable operational mission timers (1–24h) let players deliberate over a 15-minute quick party game or an all-day slow-burn workplace match.
- **Strict Anti-Shoulder-Surfing Design:** Secret code words are concealed behind a tactile *"Hold to Decrypt"* interaction, safe for public rooms, party environments, and screen sharing.
- **Screen-Safe Handshake Protocol:** Embedded moles and foreign contacts verify each other via self-destructing challenge-response notifications that leave zero persistent traces on the mole's device.
- **Anti-Forensic Burn:** Shred sensitive 1-on-1 direct message histories with a single click.
- **Two-Member Consensus Lock-in:** Eliminate griefing and single-point-of-failure Spymasters. Every official team verdict requires two teammates to agree before locking into Central Command.
- **Classified Debrief Dossier:** At mission conclusion, operatives can generate and natively share (`navigator.share`) declassified mission debriefs displaying scores, theme, personal performance, and room invite links.

---

## 2. How to Play

### 2.1 The Setup
1. **Create an Operation:**
   - The Host visits [playsubterfuge.com](https://playsubterfuge.com) and enters their operative call-sign.
   - Set the **Mission Duration** (1–24 hours, default 12h) using the slider, steppers, or quick presets (`2H`, `6H`, `12H DEF`, `24H`).
   - Share the 6-character room code (e.g., `X7K9PQ`) or direct invite link with operatives.
2. **Assemble the Roster:**
   - Operations support **6 to 12 players** ($N \in [6, 12]$), including odd player counts (7, 9, 11) with balanced 50/50 randomized faction assignment.
   - Every operative declares readiness in the lobby. Once everyone is ready, the Host initiates the mission.

### 2.2 Roles & Covert Allegiance
Every operative is secretly assigned to either the **Red Faction** or the **Blue Faction**:
- **Field Agents:** Authentic team members whose cover matches their true loyalty. Their objective is to help their team extract enemy code words and identify the enemy mole.
- **Embedded Moles (1 per team; 2 at 12 players):** Infiltrators assigned apparent cover on Team A, but secret *true loyalty* to Team B.
  - *Win Condition:* Moles win **if and only if their TRUE faction wins**.
  - *Espionage:* A mole must subtly sabotage their apparent squad's deliberations without getting caught, while secretly feeding intel to their true faction.

### 2.3 Gameplay Phases

#### Phase 1: Infiltration (Secret Words & Comms)
- **Classified Word Assignment:** Each operative is assigned an authentic code word belonging to a single, classified global theme (e.g., Theme: *"Dance"*; Words: `BALLET`, `TANGO`, `WALTZ`, `STEP`).
- **Midpoint Theme Intercept:** At exactly 50% elapsed mission duration, Central Command broadcasts the overarching mission theme to all operatives.
- **Communications Network:**
  - **Public Wire:** Broadcast to all players across both factions.
  - **Encrypted Team Radio:** Visible only to players wearing the same apparent team cover.
  - **Covert DMs:** Private 1-on-1 channels between any two operatives.
  - **Anti-Forensic Burn:** Either party in a DM can permanently burn the chat history.
- **The Mole Clearance Protocol:**
  - If you suspect an operative on the enemy team is secretly your mole, send them a clearance challenge in a 1-on-1 DM.
  - If they are truly your mole, they see an ephemeral 3-second notification confirming the contact (`"Operative Verified"`), leaving no persistent evidence on their screen.
  - You receive a persistent cryptographic receipt: `CONFIRMED ASSET`.

#### Phase 2: Verdict & Deliberation
- Operatives collaborate on their team's deliberation board:
  - Propose candidate words deduced from enemy comms.
  - Upvote promising suggestions.
  - Indict a suspected enemy mole.
- **Two-Member Consensus Protocol:** Any operative can draft the team's official slate. To submit, a second teammate must confirm and lock in the proposed slate.

#### Phase 3: Debrief & Scoring
Central Command calculates faction scores using the **Mission Meter Scoring Engine**:

$$\text{Final Score} = \max\left(0, \text{Extraction} - \text{Penalty}\right) + \text{Mole Bonus}$$

- **Enemy Word Extraction ($0\%\dots 100\%$):** Percentage of authentic enemy code words accurately deduced.
- **Internal Sabotage Penalty (-20% flat per word):** Each authentic word from the team's own squad that was omitted or replaced by a decoy.
- **Mole Indictment Bonus (+20% flat):** Accurately naming the embedded enemy mole.

Operatives can click **"SHARE MISSION DOSSIER"** to copy or share the full declassified debrief to Discord, Twitter/X, Reddit, or messaging apps.

---

## 3. Architecture & Tech Stack

```text
subterfuge2/
├── src/
│   ├── app/
│   │   ├── api/rooms/             # REST endpoints (lifecycle, comms, mole protocol, verdicts)
│   │   ├── room/[code]/page.tsx   # Unified client interface (Lobby, Infiltration, Verdict, Debrief)
│   │   ├── layout.tsx             # Root CRT scanline aesthetic & metadata
│   │   ├── globals.css            # Custom retro-terminal styling
│   │   └── page.tsx               # Home landing & room creation
│   └── lib/
│       ├── store/game-store.ts    # Dual-engine state store (Upstash Redis + local fallback)
│       ├── types/game.ts          # TypeScript data contracts & enums
│       └── utils/dossier.ts       # Debrief dossier generator & share formatter
├── tests/
│   ├── e2e/                       # 8 domain-driven Playwright E2E suites
│   └── unit/                      # 11 Vitest unit test suites (124 tests)
```

- **Framework:** Next.js 15 (App Router, Server Components + Client Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS with custom thematic extensions (`classified-amber`, `classified-crimson`, `classified-terminal`, `carbon-*`)
- **State Store:** Dual-engine architecture:
  - **Production:** Distributed Upstash Redis with distributed mutex locking (`withLock`).
  - **Local / Test:** JSON file persistence fallback (`.data/game-store.json`) with auto-degradation if Redis quotas are exceeded.
- **Testing:**
  - **Vitest:** 124 unit tests covering scoring, role balancing, lifecycle, sanitization, comms, and route validation (~500ms execution).
  - **Playwright:** 8 multi-context domain suites simulating concurrent operatives across desktop, tablet, and mobile viewports.

---

## 4. How to Contribute

We welcome contributions from human developers, pair programmers, and autonomous AI agents!

### 4.1 Prerequisites
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher

### 4.2 Local Development Setup
```bash
# 1. Clone repository
git clone https://github.com/zinc-zeppelin/subterfuge2.git
cd subterfuge2

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev

# 4. Open http://localhost:3000 in your browser
```

### 4.3 Running Tests
All pull requests must maintain 100% passing tests:

```bash
# Run unit & contract test suite (124 tests, ~500ms)
npm run test

# Run a specific domain E2E test suite
npx playwright test tests/e2e/lobby.spec.ts

# Run the complete Playwright E2E suite
npx playwright test

# Verify production build and TypeScript compilation
npm run build
```

### 4.4 Contribution Guidelines & Repository Directives

Before contributing, please read [**`AGENTS.md`**](AGENTS.md) and [**`CLAUDE.md`**](CLAUDE.md). Key directives include:

1. **Always Use Pull Requests:** Direct pushes to `main` are strictly prohibited. All changes must be submitted via a feature branch and PR against `main`.
2. **Strict Security & Data Sanitization:** Client applications must NEVER receive unredacted secret data before official declassification. Always route client state through `getClientGameState(code, sessionToken)`.
3. **Mandatory CodeRabbit Review Pass:**
   - Every PR must pass automated review by CodeRabbit.
   - **10-Minute Review Buffer Practice:** Whenever a PR is created or updated, contributors and automated agents must wait at least **10 minutes** before checking for CodeRabbit comments to ensure the automated analysis has completed without premature polling.
   - All actionable comments must be addressed and resolved before merging.
4. **Never Break Passing Tests:** Always run `npm run test` and `npm run build` prior to committing. New features must include both unit and E2E coverage.
5. **Cold War Aesthetic Integrity:** Maintain the atmospheric retro-intelligence aesthetic using monospace fonts (`font-mono`), scanlines, classified stamps, and the carbon palette.

---

## 5. Security & Responsible Disclosure

If you discover a vulnerability or state leakage exploit, please open a private GitHub Security Advisory or report it directly to the repository maintainers.

---

## 6. License

Project Subterfuge is proprietary software. All rights reserved.
