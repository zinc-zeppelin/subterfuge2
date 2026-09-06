---
name: Project Subterfuge
description: Cold War Classified Intelligence Operative Console & Surveillance Suite
colors:
  carbon-950: "#08080a"
  carbon-900: "#111115"
  carbon-850: "#18181f"
  carbon-800: "#22222b"
  carbon-700: "#32323e"
  classified-amber: "#f59e0b"
  classified-amber-hover: "#d97706"
  classified-crimson: "#ef4444"
  classified-crimson-deep: "#991b1b"
  classified-intelBlue: "#3b82f6"
  classified-intelBlue-deep: "#1e40af"
  classified-terminal: "#10b981"
  classified-terminal-deep: "#065f46"
  text-primary: "#f3f4f6"
  text-muted: "#9ca3af"
  text-dim: "#6b7280"
typography:
  display:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.1em"
  headline:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.05em"
  title:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.05em"
  body:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.025em"
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
  micro:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
  nano:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  tactical-button-primary:
    backgroundColor: "{colors.classified-amber}"
    textColor: "{colors.carbon-950}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    typography: "{typography.label}"
  tactical-button-danger:
    backgroundColor: "{colors.classified-crimson-deep}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    typography: "{typography.label}"
  dossier-panel:
    backgroundColor: "{colors.carbon-900}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: Project Subterfuge

## 1. Overview
Project Subterfuge embodies the visual and physical weight of a Cold War intelligence surveillance terminal. The interface is high-stakes, tactile, and deliberately utilitarian—every line of code and pixel evokes real espionage agency, military telemetry, and clandestine signal wiretapping.

### Creative North Star: "The Berlin Signal Intercept"
The atmosphere is not generic dark-mode SaaS; it is a secured terminal in a subterranean intelligence listening post beneath West Berlin, circa 1983. CRT phosphor persistence, teletype ink, classified ink-stamp seals, and tactile hold-to-decrypt controls define every interaction.

## 2. Colors
The palette is built on strict intelligence compartmentalization rules:

- **Carbon Tactical Base:** `#08080a` (primary viewport bedrock), `#111115` (dossier sheet grounds), `#18181f` (elevated control plates), `#22222b` (grid boundaries).
- **Classified Amber (`#f59e0b`):** Top secret intelligence, master operational instructions, and unread transmission telemetry.
- **Classified Crimson (`#ef4444` / `#991b1b`):** Apparent Red Cover, enemy mole indictments, and emergency forensic burn protocols.
- **Intelligence Blue (`#3b82f6` / `#1e40af`):** Apparent Blue Cover, friendly radio communications, and cryptographic verification receipts.
- **Terminal Phosphor Green (`#10b981` / `#065f46`):** Cryptographically confirmed asset status, operational readiness, and declassified mission success.

## 3. Typography
A strict monospace typography scale (`font-mono`) governs all visible interface elements. Proportional sans-serif typefaces are forbidden.

- **Display (`clamp(1.75rem, 4vw, 2.5rem)`):** Operation title, phase declarations (`COMMENCE INFILTRATION`), and debrief outcomes. All caps, wide letter-spacing (`tracking-widest`).
- **Headlines & Subheads (`1rem` to `1.25rem`):** Dossier headings, deliberation boards, codebook tables.
- **Body (`0.875rem` / `14px`):** Comms wire text, mission debriefs, operational field manual procedures.
- **Micro-Labels (`0.75rem` / `12px` and `0.6875rem` / `11px`):** Military timestamps, security clearance badges, channel tags (`[RED RADIO]`, `[PUBLIC WIRE]`).

## 4. Layout
- **No Card Nesting:** Avoid "cards inside cards inside cards". Use unified dossier sheets separated by crisp hairline boundaries (`border-carbon-800`), teletype dividers, and color-coded status stripes.
- **Operational Ergonomics:** Desktop displays a 3-column command grid (Left: Classified Dossier & Hold-to-Decrypt; Middle: Intelligence Comms & Radio Wire; Right: Active Operative Rosters & Direct Lines).
- **Mobile First-Class Hierarchy:** Mobile single-column layout places immediate action items above the fold (Mission Timer, Classified Dossier, Unread Transmission Alerts) with smooth, anchored navigation to comms panels and interactive rosters. Minimum touch target size is strictly 44px.

## 5. Elevation & Depth
Depth in Subterfuge is achieved through physical and tonal layering rather than fuzzy drop shadows:
- **Tonal Stepping:** Layering goes from darkest bedrock (`bg-carbon-950`) to panel surface (`bg-carbon-900`) to active control wells (`bg-carbon-850`).
- **Tactile Insets:** Buttons feel like mechanical switches—they feature crisp 1px borders, active states with `active:scale-[0.98]` and border color shifts, rather than floaty ambient blurs.
- **CRT Scanlines:** Subtle ambient scanline overlay (`crt-scanline`) gives the terminal authentic cathode-ray tube texture without impeding readability.

## 6. Shapes & Form Language
- **Sharp Precision:** Border radii are tight and disciplined (`rounded-md` or `rounded-lg`, never pill-shaped bubbly buttons for core actions).
- **Physical Affordances:** Press plates feature knurled edges, classified corner stamps, and teletype perforated lines.
- **Tactile Hold-to-Decrypt:** A physical hold-to-reveal plate that visually charges up with a progress sweep while held down, snapping closed the instant the operative releases their finger or cursor.

## 7. Tactical Components
- **The Classified Dossier:** Stamped with `TOP SECRET // LEVEL 4 CLEARANCE`. Masks secret code words behind a screen-share safe physical hold interaction.
- **Comms Wire:** Multi-channel teletype feed with audible military radio chimes on incoming packets, auto-scrolling message streams, and anti-forensic 1-on-1 burn shredder.
- **Clearance Handshake Toast:** A self-destructing, ephemeral 3-second green phosphor toast that confirms embedded mole verification without leaving any persistent DOM footprints.
- **Interactive Operative Roster:** Direct-line clickable roster badges with 44px touch targets and instant channel switching.

## 8. Do's and Don'ts
- **DO** keep all typography strictly monospace with deliberate tracking.
- **DO** use authentic intelligence terminology (`OPERATIVE`, `COMMENCE INFILTRATION`, `FORENSIC BURN`, `DECLASSIFIED`).
- **DO** maintain 100% information security—never render secret words or true mole loyalties in DOM nodes before debrief.
- **DON'T** use generic SaaS tropes: no pastel purple gradients, no bubbly pill buttons, no nested cards.
- **DON'T** make the user guess what is clickable: ensure hover states, active states, and mobile touch targets have high visual clarity.
- **DON'T** leak secrets during screen shares: enforce hold-to-decrypt and ephemeral verifications across all operative roles.
