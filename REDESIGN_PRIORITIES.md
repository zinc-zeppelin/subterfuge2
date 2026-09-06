# Project Subterfuge — Master Redesign Priorities & Review Synthesis

**Date:** September 6, 2026  
**Document Purpose:** Comprehensive compilation of all redesign recommendations, usability critiques, and architectural directives produced by the Impeccable review agents (**Assessment A: Design Review Director**, **Assessment B: Deterministic Detector & Technical Scan**, **Game Web App Architect**, and **Persona Playtesters**).

---

## Executive Status Dashboard

| Category | Total Identified | Completed | Pending / Action Required | Health Score |
|---|:---:|:---:|:---:|:---:|
| **P1: Critical Usability & Safety** | 4 | 1 | **3** | Needs Attention |
| **P2: Cognitive Load & Ergonomics** | 6 | 2 | **4** | Moderate |
| **P3: Polish, Immersion & Architecture** | 5 | 3 | **2** | Good |
| **System Governance (Detector)** | 3 | 3 | **0** | **100% Clean** |

---

## Tier 1 (P1): Critical Usability, Error Prevention & Safety

### 1.1 Guardrails on Irreversible Destructive Actions (High Priority)
* **Flagged By:** Assessment A (Design Review Director, Heuristic 3 & 5), Elena Persona Playtest.
* **Current State:**
  - In 1-on-1 DMs, clicking `BURN CONVERSATION` (`#burn-dm-btn`) instantly shreds the entire message history on the server without any confirmation or delay.
  - In `VERDICT`, Spymaster clicking `LOCK IN OFFICIAL VERDICT` (`#submit-verdict-btn`) transmits the final irreversible team guesses immediately.
  - In Lobby, Host clicking `DISMISS` (`#kick-player-*`) immediately purges an operative.
* **The Problem:** In a high-energy party game or on mobile devices, an accidental brush of the thumb permanently wipes crucial DM evidence or prematurely locks in a team's guesses before deliberation is finished.
* **Required Redesign:**
  1. **Hold-to-Authorize Mechanical Switch (Recommended):** Convert both `BURN CONVERSATION` and `LOCK IN OFFICIAL VERDICT` into a 2-second hold-and-sweep button with a tactical progress fill (similar to `#decrypt-word-btn`) or a dual "Two-Man Rule" arming switch.
  2. **Emergency Confirmation Intercept:** Alternatively, trigger a modal confirmation: `"CONFIRM FORENSIC BURN // THIS CANNOT BE UNDONE"` and `"CONFIRM FINAL SPYMASTER VERDICT // ALL GUESSES BECOME PERMANENT"`.
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🔴 **PENDING**

---

### 1.2 Mobile Viewport Cramping & Virtual Keyboard Occlusion
* **Flagged By:** Assessment A (Elena Persona), Architect Audit (Mobile Safari Quirk).
* **Current State:**
  - On mobile screens ($< 768\text{px}$), the Top Secret Dossier card, Midpoint Alert Banner, Communications Terminal (`h-[460px]`), and two team rosters are all stacked vertically in a single column exceeding 1,600px of scroll height.
  - When typing into `#message-input` on mobile, the software keyboard pushes the chat input and messages off-screen.
* **The Problem:** Operatives spend 80% of active play frantically scrolling up and down between checking their secret code word, reading transmissions, and looking at the player roster.
* **Required Redesign:**
  1. **Mobile Tactical Pager (Option A):** Implement a persistent, bottom-anchored 3-tab pager for screens $< 768\text{px}$:
     - `[DOSSIER]` (Secret word, role, theme intercept, recovery link)
     - `[COMMS]` (Full-height teletype radio terminal, auto-pinned above keyboard)
     - `[ROSTER]` (Apparent team manifests, direct line action triggers)
  2. **Dynamic Viewport Height (`100dvh`):** Ensure the active panel occupies exact viewport height without body scroll bouncing.
* **Target File:** `src/app/room/[code]/page.tsx`, `src/app/globals.css`
* **Status:** 🟡 **PARTIALLY ADDRESSED** (Sticky anchors added; full mobile pager mode pending)

---

### 1.3 Sub-44px Secondary Touch Target Violations
* **Flagged By:** Assessment B (Detector & Browser Auditor, Section 3.1).
* **Current State:**
  - While primary CTAs (`#start-operation-btn`, `#toggle-ready-btn`, `#send-message-btn`) are $\ge 44\text{px}$, several secondary interactive elements fail WCAG 2.5.5 and Apple Human Interface Guidelines:
    - Verdict Deliberation Upvote & Adopt (`#upvote-btn-*`, `#adopt-word-btn-*`): computed height $\approx 24\text{px}$ (`px-2 py-1`).
    - Lobby Host Kick button (`#kick-player-*`): computed height $\approx 22\text{px}$ (`px-2 py-1 text-[10px]`).
    - Comms Channel Tabs (`#tab-public`, `#tab-team`, `#tab-dm`): originally `min-h-[40px]`.
    - Clearance Handshake CTAs (`#submit-counter-signature-btn`, `#decline-challenge-btn`): originally `min-h-[36px]`.
    - Toast and notice dismiss buttons: computed height $\approx 18\text{px}$ (`p-0.5 w-3.5 h-3.5`).
* **The Problem:** Mis-taps under time pressure during the 8-second mole handshake window or while upvoting candidate words.
* **Required Redesign:**
  - Enforce strict `min-h-[44px]` and `min-w-[44px]` tap target boundaries across all interactive buttons, or expand hit target padding using pseudo-elements (`before:absolute before:-inset-2`).
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🟡 **PARTIALLY ADDRESSED** (Channel tabs expanded; deliberation & kick buttons pending)

---

## Tier 2 (P2): Cognitive Load, Visual Hierarchy & Ergonomics

### 2.1 Jargon Barrier & High Visual Noise Floor
* **Flagged By:** Assessment A (Cognitive Load 8-Point Checklist, Devon Persona).
* **Current State:**
  - Operatives are simultaneously presented with: pulsing crimson status stamps, amber intercept countdowns, green readiness badges, colored cover borders, and Cold War terminology (*Apparent Cover, True Allegiance, Counter-Signature, Sleeper Protocol*).
* **The Problem:** Casual players (Devon) fail the 2-second glance test. In a noisy room, they freeze, unsure whether they are supposed to lie or tell the truth, and miss their team's radio chatter.
* **Required Redesign:**
  1. **Inline Plain-English Subtitles:** Add contextual micro-guides directly on the dossier:
     - `APPARENT COVER` $\rightarrow$ `[COVER: RED TEAM] (What opposing operatives see)`
     - `TRUE ALLEGIANCE` $\rightarrow$ `[LOYAL TO: BLUE TEAM] (Your actual objective)`
  2. **Visual Hierarchy Quieting:** Mute passive cards to solid dark bedrock (`bg-carbon-950 border-carbon-800`), reserving glowing amber/crimson strictly for active urgent events (incoming challenge, midpoint intercept arrival).
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🔴 **PENDING**

---

### 2.2 Verdict Phase Chaos: Deliberation vs Lock-In Separation
* **Flagged By:** Assessment A (Cognitive Load, Decision Points $>4$).
* **Current State:**
  - In `VERDICT`, Spymasters see candidate word proposals, upvote counters, adoptive word buttons, 4–6 manual text inputs, and the Mole Indictment dropdown all crammed inside a single card.
* **The Problem:** High cognitive load. Deliberating with teammates while simultaneously managing official guess slots creates visual confusion and risks premature submission.
* **Required Redesign:**
  1. **Split-Zone Verdict Board:**
     - Zone A (Collaborative Intelligence): Team Deliberation Wire where all operatives propose and upvote words.
     - Zone B (Command Seal): Spymaster-only lock-in console, clearly demarcated with "OFFICIAL VERDICT SUBMISSION" styling and slot-by-slot confirmation.
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🔴 **PENDING**

---

### 2.3 Ephemeral Clearance Toast Lifespan & Radial Countdown
* **Flagged By:** Assessment A (Emotional Journey & Reassurance at High-Stakes Moments).
* **Current State:**
  - Genuine moles receiving a covert clearance challenge see a 3-second green toast (`CONFIRMED ASSET`) that vanishes completely.
* **The Problem:** 3 seconds is too fast if the player blinked or looked up at someone speaking. The player misses whether the verification succeeded or failed.
* **Required Redesign:**
  - Extend toast duration to **5 seconds**, accompanied by a visible radial or linear progress sweep showing exact remaining lifespan before self-destruction.
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🔴 **PENDING**

---

### 2.4 Ergonomic Decrypt Placement (Thumb Obscuration)
* **Flagged By:** Assessment A (Elena Persona Walkthrough).
* **Current State:**
  - The `#decrypt-word-btn` sits directly below the secret word display container.
* **The Problem:** On mobile phones held in one hand, pressing the button with the right thumb physically covers the text area where the decrypted word appears.
* **Required Redesign:**
  - Position the revealed word container above or to the side of the press plate with adequate optical clearance (minimum 60px vertical separation), ensuring the thumb never blocks the operative's line of sight.
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🔴 **PENDING**

---

### 2.5 Optimistic Message Dispatch on Comms Wire
* **Flagged By:** Assessment A (Heuristic 1: Visibility of System Status).
* **Current State:**
  - Transmitting a message (`#send-message-btn`) waits for the server POST response and next polling interval (up to 1,000ms) before rendering in `#message-list`.
* **The Problem:** The user perceives a sluggish lag between hitting `TRANSMIT` and seeing their transmission print out on the teletype wire.
* **Required Redesign:**
  - Implement optimistic rendering: immediately prepend or append the outgoing transmission to the local feed in an amber `[DISPATCHING...]` state, transitioning to confirmed teletype receipt upon HTTP 200.
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🔴 **PENDING**

---

## Tier 3 (P3): Immersion, Polish & Architecture

### 3.1 Monolithic File Architecture (`page.tsx` > 3,700 Lines)
* **Flagged By:** Assessment B (Section 4), Code Reviewer Subagent.
* **Current State:**
  - `src/app/room/[code]/page.tsx` contains 3,790+ lines of TypeScript/TSX code managing all 4 game phases, modal dialogs, timers, comms tabs, audio synthesis, and developer tools.
* **The Problem:** High risk of regression when touching one subsystem, slow IDE linting, and cognitive overhead for developers.
* **Required Redesign:**
  - Decompose into domain components under `src/components/room/`:
    - `LobbyView.tsx`
    - `InfiltrationView.tsx`
    - `VerdictView.tsx`
    - `DebriefView.tsx`
    - `CommsTerminal.tsx`
    - `FieldManualModal.tsx`
    - `DevConsole.tsx`
* **Target File:** `src/app/room/[code]/page.tsx` $\rightarrow$ `src/components/room/*`
* **Status:** 🔴 **PENDING**

---

### 3.2 Diegetic Audio Cues & Mechanical Rotary Haptics
* **Flagged By:** Assessment A (Minor Observations), Impeccable Motion Directive.
* **Current State:**
  - Web Audio API synthesizer generates synthetic beeps for timers and toasts.
* **The Opportunity:** Authentic Cold War immersion:
  - Teletype mechanical clack on message receive.
  - Radio static burst when switching frequencies between Public and Team Radio.
  - Heavy mechanical "thunk" / lock sound when Spymaster authorizes the final verdict.
* **Target File:** `src/app/room/[code]/page.tsx`
* **Status:** 🟡 **PARTIALLY ADDRESSED** (Synthesizer exists; mechanical audio samples pending)

---

### 3.3 Host Migration on Inactive / Disconnected Hosts
* **Flagged By:** Architect Audit (Flaw E: Deadlock on Abandonment).
* **Current State:**
  - If the host leaves or closes their tab in `LOBBY`, the match is stuck.
* **Required Redesign:**
  - If `hostId` departs or disconnects for $>45$ seconds, automatically transfer host privileges to the next oldest connected operative in `room.players`.
* **Target File:** `src/lib/store/game-store.ts`, `src/app/api/rooms/[code]/leave/route.ts`
* **Status:** 🔴 **PENDING**

---

## Completed Improvements Log

| Improvement | Scope | Verification |
|---|---|---|
| **Cold War Favicon Overhaul** | Replaced SaaS squircle with 4-point amber cipher star & crimson reticle across SVG, PNG (16/32/180), and ICO | Verified in browser tabs & `scripts/generate-favicons.ts` |
| **Comms Wire Auto-Scroll** | Programmatic multi-pass scroll pinning (`scrollTop = scrollHeight`) on notification taps & channel switches | Verified across desktop & mobile Safari contexts |
| **Teletype Line Comms Feed** | Replaced asymmetric WhatsApp chat bubbles (`ml-8`/`mr-8`) with full-width teletype lines & faction stripes | Passes `slice3-communication.spec.ts` |
| **Header De-SaaSification** | Replaced 8 stacked cards with a compact 2-row tactical telemetry bar | Clean layout, passes `slice13-playtest-improvements.spec.ts` |
| **Stream-Safe Redaction Mode** | Added `#toggle-stream-safe-btn` to mask guesses, suggestions, and words for Discord streamers | Verified in `slice13` |
| **Keyboard Accessibility on Decrypt** | Added `Space` / `Enter` keydown/keyup on `#decrypt-word-btn` | Tested & verified |
| **Impeccable Detector Remediation** | Zero findings (`[]`) on `.agents/skills/impeccable/scripts/impeccable detect` | Exit code 0, 0 findings |
| **Full Regression Suite** | 100% green across all 13 Playwright test suites (14 tests) | `14 passed (3.7m)` |

---

## Proposed Implementation Execution Plan

When authorized, we can execute the remaining high-impact redesign priorities in three focused waves:

1. **Wave 1: High-Stakes Safety & Guardrails (P1.1, P1.3)**
   - Add Hold-to-Authorize (2s physical sweep) or Confirmation Modal to `BURN CONVERSATION`, `LOCK IN VERDICT`, and Lobby `DISMISS`.
   - Ensure all secondary buttons adhere to $\ge 44\text{px}$ touch targets.
2. **Wave 2: Mobile Tactical Pager & Viewport Ergonomics (P1.2, P2.4)**
   - Implement the 3-panel mobile pager (`[DOSSIER]`, `[RADIO]`, `[ROSTER]`) on small viewports so Elena never has to scroll 1600px.
   - Separate decrypt press plate from secret word text area to prevent thumb obscuration.
3. **Wave 3: Cognitive Clarity, Jargon Reduction & Deliberation Split (P2.1, P2.2, P2.3, P2.5)**
   - Add inline plain-English tooltips for Apparent Cover vs True Allegiance.
   - Split Verdict board into Collaborative Deliberation Wire vs Spymaster Command Console.
   - Extend Mole Handshake Toast to 5 seconds with radial countdown ring.
   - Add optimistic message dispatch to Comms wire.
