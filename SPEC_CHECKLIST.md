# Subterfuge Specification Compliance Checklist

This checklist tracks implementation, code review, and playtest verification for every requirement specified in [SUBTERFUGE_SPECIFICATION.md](./SUBTERFUGE_SPECIFICATION.md).

---

## 1. Core Architecture & Game Configuration
- [x] **Lobby & Room System**
  - [x] 6-character unique alphanumeric room code generation (Verified in Slice 1)
  - [x] Anonymous session persistence via HTTP cookie & session token (Verified in Slice 1)
  - [x] Host controls (duration, verdict timer, start trigger criteria) (Verified in Slice 1)
- [x] **Player Counts & Constraints**
  - [x] Strict even player enforcement ($N \in \{4, 6, 8, 10, 12\}$) (Verified in Slice 1)
  - [x] Player ready toggle state machine with session authorization (Verified in Slice 1)
  - [x] Dynamic team balancing ($N/2$ Red, $N/2$ Blue) (Verified in Slice 2)

## 2. Role Distribution Matrix
- [x] **Spymaster**
  - [x] Exactly 1 Red Spymaster and 1 Blue Spymaster per game (Verified in Slice 2)
  - [ ] Exclusive verdict lock-in authority (Scheduled: Slice 7)
- [x] **Embedded Mole**
  - [x] 1 Mole per team for $N \in \{4, 6, 8, 10\}$; 2 Moles per team for $N = 12$ (Verified in Slice 2)
  - [x] Apparent team vs actual team distinction in database & UI (Verified in Slice 2)
  - [ ] Moles win strictly if their actual team wins (Scheduled: Slice 7)
- [x] **Field Agents**
  - [x] Correct distribution for remaining slots (Verified in Slice 2)

## 3. Thematic Word Bank & Assignment Engine
- [x] **Dictionary & Metadata**
  - [x] Curated bank of categorized nouns with multi-theme tagging (Verified in Slice 2)
- [x] **Assignment Logic**
  - [x] Random primary theme selection at game launch (Verified in Slice 2)
  - [x] $N$ distinct words drawn from selected theme and assigned 1-per-player (Verified in Slice 2)
  - [x] Theme name withheld from players at start (Verified in Slice 2)
- [x] **Midpoint Theme Declassification**
  - [x] Automated intelligence broadcast triggered at 50% elapsed time (Verified in Slice 5)
  - [x] Global banner displaying the confirmed operational theme (Verified in Slice 5)

## 4. Covert Operations & Mole Verification
- [x] **Screen-Share Safe Targeted Challenge**
  - [x] Routine "Verify Operative Credentials" button present for all players in 1-on-1 DMs (Verified in Slice 4)
  - [x] Identical challenge prompt displayed to all targeted players (Verified in Slice 4)
  - [x] Non-moles receive "Clearance Denied" with no special actions (Verified in Slice 4)
  - [x] Genuine moles submit counter-signature and receive a 3-second self-destruct toast (Verified in Slice 4)
  - [x] Requester receives permanent cryptographic verified asset receipt (Verified in Slice 4)
- [x] **Anti-Forensics**
  - [x] "Burn Conversation" button in 1-on-1 DMs to erase message history (Verified in Slice 3)

## 5. Communication Suite & Channel Isolation
- [x] **Channel Structure**
  - [x] Public Wire (all players) (Verified in Slice 3)
  - [x] Red Team Radio (apparent Red players, including Red Mole) (Verified in Slice 3)
  - [x] Blue Team Radio (apparent Blue players, including Blue Mole) (Verified in Slice 3)
  - [x] 1-on-1 Direct Messages (between any arbitrary pair) (Verified in Slice 3)
- [x] **Security & Leak Prevention**
  - [x] Server-side channel access enforcement (clients cannot read unauthorized messages) (Verified in Slice 3)

## 6. Endgame Verdicts & Scoring (+1 / 0)
- [x] **Verdict Deliberation**
  - [x] 1-Hour Verdict Phase countdown upon main timer expiry (Verified in Slice 5)
  - [x] Collaborative team proposal board (upvoting / suggesting words) (Verified in Slice 6)
- [x] **Submission & Scoring**
  - [x] Spymaster lock-in mechanism (capped at $N$ words) (Verified in Slice 6)
  - [x] Must guess all $N$ words (including own team members' words) (Verified in Slice 6)
  - [x] Scoring engine: $+1$ per correct word, $0$ for incorrect guesses (Verified in Slice 6)
  - [x] Tiebreaker: Mole indictment (+2 points) / Draw resolution (Verified in Slice 6)

## 7. UI/UX & Classified Cold War Aesthetic
- [x] Carbon dark theme (`#0b0d10`), Top Secret Crimson, Surveillance Blue, Terminal Green (Verified in Slice 1)
- [x] Monospace typewriter styling & classified stamps (Verified in Slice 1)
- [x] "Hold to Decrypt" redaction bars over secret role and code word (anti-shoulder surfing) (Verified in Slice 2)

## 8. Automated Verification & Testing
- [x] **6-Player Automated Playwright Test Harness**
  - [x] Slice 1: Multi-context connectivity, 6-player lobby orchestration, and session verification (Passed: 11.9s)
  - [x] Slice 2: Operational deployment, balanced role matrix, secret word assignment, and anti-peeking (Passed: 6.8s)
  - [x] Slice 3: Channel isolation between Public, Team Radio, and 1-on-1 DMs, and conversation burning (Passed: 12.8s)
  - [x] Slice 4: Targeted Mole verification and 3s toast disappearance (Passed: 8.6s)
  - [x] Slice 5: Midpoint declassification broadcast and phase shift (Passed: 8.8s)
  - [x] Slice 6: 6-player verdict submission and scoring (Passed: 12.6s)
  - [ ] Slice 7: Full end-to-end 6-player match and debrief reveal
