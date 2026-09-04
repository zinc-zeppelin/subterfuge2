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
- [ ] **Midpoint Theme Declassification**
  - [ ] Automated intelligence broadcast triggered at 50% elapsed time (Scheduled: Slice 6)
  - [ ] Global banner displaying the confirmed operational theme (Scheduled: Slice 6)

## 4. Covert Operations & Mole Verification
- [ ] **Screen-Share Safe Targeted Challenge**
  - [ ] Routine "Verify Operative Credentials" button present for all players in 1-on-1 DMs
  - [ ] Identical challenge prompt displayed to all targeted players
  - [ ] Non-moles receive "Clearance Denied" with no special actions
  - [ ] Genuine moles submit counter-signature and receive a 3-second self-destruct toast
  - [ ] Requester receives permanent cryptographic verified asset receipt
- [ ] **Anti-Forensics**
  - [ ] "Burn Conversation" button in 1-on-1 DMs to erase message history

## 5. Communication Suite & Channel Isolation
- [ ] **Channel Structure**
  - [ ] Public Wire (all players)
  - [ ] Red Team Radio (apparent Red players, including Red Mole)
  - [ ] Blue Team Radio (apparent Blue players, including Blue Mole)
  - [ ] 1-on-1 Direct Messages (between any arbitrary pair)
- [ ] **Security & Leak Prevention**
  - [ ] Server-side channel access enforcement (clients cannot read unauthorized messages)

## 6. Endgame Verdicts & Scoring (+1 / 0)
- [ ] **Verdict Deliberation**
  - [ ] 1-Hour Verdict Phase countdown upon main timer expiry
  - [ ] Collaborative team proposal board (upvoting / suggesting words)
- [ ] **Submission & Scoring**
  - [ ] Spymaster lock-in mechanism (capped at $N$ words)
  - [ ] Must guess all $N$ words (including own team members' words)
  - [ ] Scoring engine: $+1$ per correct word, $0$ for incorrect guesses
  - [ ] Tiebreaker: Mole indictment (+2 points) / Draw resolution

## 7. UI/UX & Classified Cold War Aesthetic
- [x] Carbon dark theme (`#0b0d10`), Top Secret Crimson, Surveillance Blue, Terminal Green (Verified in Slice 1)
- [x] Monospace typewriter styling & classified stamps (Verified in Slice 1)
- [x] "Hold to Decrypt" redaction bars over secret role and code word (anti-shoulder surfing) (Verified in Slice 2)

## 8. Automated Verification & Testing
- [x] **6-Player Automated Playwright Test Harness**
  - [x] Slice 1: Multi-context connectivity, 6-player lobby orchestration, and session verification (Passed: 11.9s)
  - [x] Slice 2: Operational deployment, balanced role matrix, secret word assignment, and anti-peeking (Passed: 6.8s)
  - [ ] Slice 4: Channel isolation and DM burn
  - [ ] Slice 5: Targeted Mole verification and 3s toast disappearance
  - [ ] Slice 6: Midpoint declassification broadcast
  - [ ] Slice 7: 6-player verdict submission and scoring
  - [ ] Slice 8: Full end-to-end 6-player match
