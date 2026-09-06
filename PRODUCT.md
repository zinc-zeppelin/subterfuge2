# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Operatives and social deduction party gamers (6 to 12 players) playing in-person or remotely via voice/screen-share channels (Discord, Zoom, Google Meet) on mobile and desktop browsers.

## Product Purpose
Subterfuge is an asynchronous, high-stakes Cold War social deduction web game. Two rival intelligence factions (Red vs. Blue) race to decipher encrypted codebook words while identifying or protecting embedded moles without blowing their cover.

## Positioning
Jackbox Games / Among Us / Codenames meets authentic Cold War classified intelligence console. Features zero-leak server state sanitization, tactile screen-share safe interactions ("Hold to Decrypt", ephemeral clearance handshakes), encrypted multi-channel comms (Public Wire, Team Radio, 1-on-1 DMs with forensic burn), and hybrid session recovery links.

## Operating Context
- Operating environments: Mobile Safari (iOS), Chrome (Android/Desktop), Firefox, Safari.
- Play situations: Living room party games, remote Discord game nights, live streams.
- Operational rituals: Holding to decrypt secret code words, covert 1-on-1 clearance challenges, intercepting the 50% midpoint theme broadcast, spymaster verdict lock-ins, and debrief dossiers.

## Capabilities and Constraints
- Player capacity: Strictly even counts (6, 8, 10, 12 operatives).
- Faction balance: 50% Red Cover, 50% Blue Cover; 1 Spymaster per team; 1 Mole per team (2 at 12 players); remaining Field Agents.
- Security boundary: Client applications never receive unredacted secret data from the server prior to official declassification.
- Comms alerting: Real-time Web Push and in-app alerts notify operatives when transmissions arrive in background tabs or apps.
- Session resilience: Hybrid sessionStorage/localStorage tab isolation with token recovery URLs (`/room/[code]?token=...`).

## Brand Commitments
- Name: Project Subterfuge (`SUBTERFUGE // Intelligence Operative Portal`).
- Visual world: Cold War intelligence terminal, monospace typography (`font-mono`), classified dossiers, military stamps (`classified-stamp`), CRT scanline animation (`crt-scanline`).
- Tactical Palette: Carbon tactical darks (`carbon-950`, `carbon-900`), Classified Amber (`#f59e0b`), Classified Crimson (`#ef4444`), Intelligence Blue (`#3b82f6`), Terminal Phosphor (`#10b981`).

## Product Principles
1. Zero Data Leakage: The client never receives secret intel before authorized declassification.
2. Tactile Espionage Agency: Every interaction (decrypting dossiers, issuing clearance handshakes, shredding messages) feels tactile, classified, and authentic to Cold War spycraft.
3. Screen-Share & Stream Safe: Operatives can stream or look at each other's screens without immediately leaking true identities or secret code words.
4. Seamless Mobile & Multi-Device Flow: Direct joins, recovery links, background notifications, and responsive touch controls ensure frictionless party play.

## Accessibility & Inclusion
- High-contrast text compliance for monospace readability.
- Multi-sensory transmission cues (audio chimes, visual badges, OS notifications).
- Mobile touch targets adhere to a 44px minimum bounding box.
