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
  - [ ] Dynamic team balancing ($N/2$ Red, $N/2$ Blue) (Scheduled: Slice 2)

## 2. Role Distribution Matrix
- [ ] **Spymaster**
  - [ ] Exactly 1 Red Spymaster and 1 Blue Spymaster per game
  - [ ] Exclusive verdict lock-in authority
- [ ] **Embedded Mole**
  - [ ] 1 Mole per team for $N \in \{4, 6, 8, 10\}$; 2 Moles per team for $N = 12$
  - [ ] Apparent team vs actual team distinction in database & UI
  - [ ] Moles win strictly if their actual team wins
- [ ] **Field Agents**
  - [ ] Correct distribution for remaining slots

## 3. Thematic Word Bank & Assignment Engine
- [ ] **Dictionary & Metadata**
  - [ ] Curated bank of 2,000+ single-word nouns with multi-theme tagging
- [ ] **Assignment Logic**
  - [ ] Random primary theme selection at game launch
  - [ ] $N$ distinct words drawn from selected theme and assigned 1-per-player
  - [ ] Theme name withheld from players at start
- [ ] **Midpoint Theme Declassification**
  - [ ] Automated intelligence broadcast triggered at 50% elapsed time
  - [ ] Global banner displaying the confirmed operational theme

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
- [ ] "Hold to Decrypt" redaction bars over secret role and code word (anti-shoulder surfing) (Scheduled: Slice 3)

## 8. Automated Verification & Testing
- [x] **6-Player Automated Playwright Test Harness**
  - [x] Slice 1: Multi-context connectivity, 6-player lobby orchestration, and session verification (Passed: 11.9s)
  - [ ] Slice 2: Full 6-player lobby join, ready states, room code validation
  - [ ] Slice 3: Word assignment and redaction reveal
  - [ ] Slice 4: Channel isolation and DM burn
  - [ ] Slice 5: Targeted Mole verification and 3s toast disappearance
  - [ ] Slice 6: Midpoint declassification broadcast
  - [ ] Slice 7: 6-player verdict submission and scoring
  - [ ] Slice 8: Full end-to-end 6-player match
