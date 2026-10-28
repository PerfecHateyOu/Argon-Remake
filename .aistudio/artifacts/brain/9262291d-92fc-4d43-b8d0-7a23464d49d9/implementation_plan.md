# LAST LOCAL: A Liminal Subway Horror Game — Rebuild Plan (v5.3 Canonical)

**LAST LOCAL: A Liminal Subway Horror Game** is a first-person psychological and liminal horror ride on the NYC G train from Hoyt–Schermerhorn to Court Sq across 13 stops (plus Stop 6b) at night with your Mom and Dad. This revised plan incorporates your canonical **v5.3 Story Bible** word-for-word as the single source of truth, including the exact **Midnight Terminal** and **Dawn Horizon** ending conditions, the **13 verbatim anomaly descriptions and Case File notes**, the complete segment table, and all dialogue, PA, EVP, and UI strings.

### User Review & Critical Decisions

> [!IMPORTANT]
> The plan has been updated to match the canonical **v5.3 Story Bible** word-for-word. Click **Proceed** to begin **Milestone 1 (Skeleton)**.

- **Confirmed Decision 1 — Canonical v5.3 Text & Verbatim Strings**: All titles, character labels, 13 anomaly report descriptions & Case File notes, parent chats & mask checks (Calm, Uneasy, Wrong sets), paranoid UI flashes, PA/intercom rules, EVP signal transcripts, achievements, and HUD/Report/Settings copy are locked to `/public/assets/aistudio/last-local-story-bible_b0a27c18.md` word-for-word.
- **Confirmed Decision 2 — Exact Ending Thresholds (Midnight Terminal & Dawn Horizon)**:
  - *"Composure intact"*: `peakSuspicion <= 30` (half the 60 intervention threshold).
  - **Midnight Terminal (`[BRANCH: SIGNAL ARCHIVIST]`)**: `lower-level` exit ("Follow the static down the side stairs") + `>= 2` tapes recorded + `anomalyAccuracy >= 75%` + `peakSuspicion <= 30`.
  - **Dawn Horizon (`[BRANCH: DAWN HORIZON]`)**: `escalators` exit ("Follow Mom and Dad to the escalators") + `restraintHeld === true` + no False Stop Trials + the conductor tape recorded + `Sanity Retained >= 60%`.
- **Confirmed Decision 3 — UI Stack, Offline Packaging & Local Storage**: React 19 + Tailwind CSS 4 overlays decoupled from the 60 Hz Three.js loop; single-file `index.html` + `README.txt` zipped as `Last-Local-offline.zip` (omitting Blender `.glb` export); versioned `localStorage` persistence only (no Firebase or external network calls).

---

### 1. Overview & Core Concept

- **What It Does**: "Every stop takes you further from home. A first-person liminal horror ride on the NYC G train: spot subtle anomalies, keep your composure in front of your parents, and learn which doors are safe." Across three chapters announced by an analog rollsign (*CHAPTER I — THE DESCENT*, *CHAPTER II — SIGNAL DRIFT*, *CHAPTER III — OPERATION SKYWARD* / *THE LAST STRETCH* on L and 7 lines), players notice subtle changes in the car, flag (`F` held for `0.7s`) or photograph them with the Polaroid 600 (`C`) without tipping off Mom or Dad, answer conversational mask checks (`1`/`2`/`3`), read the arrival door tells (early door opening or hard arrival light flicker), receive their grandfather's old tape recorder from Dad at the Stop 6 Safe Haven (`R`), hold steady during the Stop 11 Greenpoint Av Restraint (`Space`), and choose an exit at Court Sq.
- **Target Audience / Persona**: Players of quiet, observational liminal horror who appreciate subtle environmental storytelling, diegetic tools, and replayable branching outcomes.
- **Key Value**: A 100% procedural 3D and Web Audio experience with zero external asset dependencies that maintains 60 fps on an 8 GB M-series MacBook Air and ships as a self-contained offline HTML zip.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Start Screen (`menu`)**: Displays `"A Liminal Subway Horror Game"` / `"LAST LOCAL — to Court Sq"` over the live 3D car interior. Includes boarding CTA (`data-start="true"`), *Nightmare mode* toggle (`"Faster train, flickering tubes, sharper-eyed parents, faster sanity loss"`), *Start from* chapter selector (unlocked after first finished ride; Chapters II and III run as non-saving practice runs), *Case Files*, and *Settings*.
  2. **Practice Stretch & Chapter Rollsign (`intro`)**: Optional interactive tutorial stretch teaching *Look around*, *Don't show it*, and *Read the doors* ("The tick never lies"), followed by the analog rollsign announcing each chapter.
  3. **In-Ride Observation, Masking & Tools (`ride`)**:
     - Walk between **CAR A (LEAD)**, **CAR B (MID)**, and **CAR C (REAR)** via **PUSH GANGWAY DOOR** / **GANGWAY COUPLING**.
     - Anomalies manifest only when the player is **not looking at them** (camera turned `> ~0.7 rad` away, narrowing to `0.35 rad` after `8 s` and `0.2 rad` in the last `3 s` of the stretch; close-up anomalies only within `5 m` of your seat).
     - Catch anomalies by looking at them and holding Flag (`F` / `FLAG` button) for `0.7 s` or snapping a **Polaroid 600** photo (`C`).
     - While Mom or Dad is watching within their gaze cone, staring at an anomaly, snapping your head around (`>5.5 rad/s` mouse; `>8 rad/s` + `~75°` touch), holding up the tape recorder, playing a tape out loud, or taking a flash photo raises Suspicion (`+10` visible reaction).
     - Answer parent mask checks (`1`/`2`/`3`) with the calm response before timeout; at low sanity, paranoid words flash (`"they’re not your parents"`, `"don’t answer"`, `"it’s watching you"`, `"wrong wrong wrong"`, `"who is she"`, `"get off get off"`, `"you saw it"`, `"SAY NOTHING"`).
     - Switch route lines (`L`) between **G Brooklyn–Queens Crosstown**, **L 14th St–Canarsie Express**, and **7 Ghost Line (Abandoned Spur)**.
  4. **Stops, Safe Haven, False Stop Trial & Restraint (`stop` / `haven` / `trial`)**:
     - Listen for the chime and watch the lights: on a real stop, the chime finishes before the doors open; on a False Stop, either the doors open early before the chime finishes or the lights flicker once, hard, on arrival.
     - Stepping off at Stop 6 (Myrtle–Willoughby Avs) enters the **Safe Haven** (`+15` Sanity; Dad hands you your grandfather's old tape recorder).
     - Stepping off at a False Stop (Stops 4, 6b, 9 with the Court Square PA lie, or 12 21 St bait) triggers the **False Stop Trial** (`"Find the way back. The signs lie. Watch the lights when the chime plays."`, `-20` Sanity).
     - At Stop 11 (Greenpoint Av), the car falls silent for the **Restraint** (`"Hold Space. Don’t let go. Don’t react."`, `2.5s` grace window on pause/focus loss, `+8` Sanity and `+6` ceiling bonus on success).
  5. **Court Sq Exit & Post-Ride Report (`end`)**:
     - Choose between `"Follow Mom and Dad to the escalators"`, `"Follow the static down the side stairs"`, or `"Push through the emergency door"`.
     - View the Report Screen: Ending badge, narrative text, summary, *Sanity Retained* (with `+6 restraint bonus`), *Mask Integrity*, *Anomaly Accuracy*, *Restraint (Stop 11)*, *False Stop Trials*, developed *Polaroid Evidence*, and *Case file* Psych Log entries.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Authentic late-night NYC transit interior under warm fluorescent tubes (`0xfff0d4`) contrasted with cold sterile hospital blue (`The Cold Panel`), pitch-black tunnel fog (`0x040504`), and sodium-lit open-air steel trestle over Newtown Creek with a violet-to-navy sky shader.
  - *Color Palette & Mood*:
    - `--background`: `#040504` (Tunnel Pitch Black, `scene.fog` near `9`, far `30`)
    - `--primary`: `#fff0d4` (Warm Fluorescent Point Light Pool, distance `~9.5`, decay `1.6`)
    - `--accent-amber`: `#ffcf8a` (Warm Amber Accent & Sodium Lights)
    - `--accent-cold-panel`: `#7ab8ff` (Hospital Blue Cold Fluorescent Tube)
    - `--danger`: `#d9534f` (Critical Sanity & ECG Trace Alert)
  - *Typography & Hierarchy*:
    - Local bundled `.woff2` fonts (`Barlow Condensed` / `Plus Jakarta Sans` for transit signs, ads, and rollsigns; `Public Sans` for subtitles and dialogue; `JetBrains Mono` with `tabular-nums` for BPM, kHz tuner, and report metrics).
  - *Component Styling & Layout*:
    - Full-bleed WebGL canvas (`100vw x 100vh`) with `>= 85%` clear center viewport, zero CSS `backdrop-filter` over the canvas, and clean inline typography (`·` separators, zero static pill clutter).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Word-for-Word Canonical Narrative & Route Substitution Engine (`routeText`)**
  - *Chosen Approach*: Centralize all v5.3 strings in dedicated narrative/route modules that dynamically interpolate `{terminus}`, `{origin}`, `{originShort}`, `{line}`, `{s4}`, `{s5}`, `{s7}`, `{s10}`, `{s11}`, `{bait}`, `{street}`, and `{area}` based on the active transit line (**G**, **L**, or **7 Ghost Line**).
  - *Why*: Guarantees 100% fidelity to the v5.3 story bible while supporting mid-ride route switching (`"Switching renames the stops and announcements ahead, from now on. Every new ride starts on the G."`).

- **Decision 2: Off-Gaze Anomaly Manifestation & Dual Catch Mechanics (Flag + Polaroid)**
  - *Chosen Approach*: Anomalies only manifest when the camera angle to the target exceeds `~0.7 rad` (narrowing to `0.35 rad` after `8 s` and `0.2 rad` in the final `3 s` of a stretch), with close-up anomalies restricted to within `5 m` of the player's seat. Catching works via either holding Flag (`0.7 s`) or photographing the active anomaly with the Polaroid 600 (which develops at the end of the ride, while using flash under a parent's gaze counts as a visible reaction).
  - *Why*: Preserves the core observational horror feel—things change only when you aren't looking, and both tools integrate naturally into the Case Files and Achievements (*First Contact*, *Silver Halide Evidence*, *Chief Archivist*).

- **Decision 3: Synthesized Non-Verbal Background Intercom vs. Spoken PA Announcements**
  - *Chosen Approach*: Keep the background intercom strictly wordless (synthesized speech-cadence formants that slow down and warble as sanity drops), while spoken/subtitled PA lines use the exact shared template at every stop (`"This is the Last Local. {terminus}–bound {line} train."`, `"Stand clear of the closing doors, please."`, `"The next stop is ${stop}."` at 7 s, `"This is ${stop}."` on arrival, and Stop 9's lie `"This is Court Square. Last stop. Everybody off the train."`).
  - *Why*: Matches the exact v5.3 audio design without inventing per-stop PA scripts.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

#### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                LAST LOCAL v5.3 — SYSTEM & COMPONENT ARCHITECTURE              │
├───────────────────────────────────────┬───────────────────────────────────────┤
│       3D SIMULATION & AUDIO CORE      │         REACT 19 UI OVERLAYS          │
│     (60 Hz Loop · Pure TypeScript)    │    (Event-Driven · Zero Backdrop)     │
├───────────────────────────────────────┼───────────────────────────────────────┤
│  ┌─────────────────────────────────┐  │  ┌─────────────────────────────────┐  │
│  │      Game Engine & Phases       │  │  │   Menu & Archive Screens        │  │
│  │ menu|intro|ride|stop|haven|...  │──┼─▶│ • StartScreen & Practice Select │  │
│  └────────┬───────────────┬────────┘  │  │ • PauseScreen & SettingsPanel   │  │
│           │               │           │  │ • ReportScreen & CaseFilesModal │  │
│           ▼               ▼           │  └─────────────────────────────────┘  │
│  ┌─────────────────┐ ┌─────────────┐  │  ┌─────────────────────────────────┐  │
│  │ Domain Managers │ │ Input Hub   │  │  │   In-Ride Diegetic HUD          │  │
│  │ • Segment Table │ │ • PointerLk │  │  │ • StatusChip & HeartbeatTrace   │  │
│  │   (13 + Stop 6b)│ │   (Raw/Fb)  │  │  │ • AnalogRollsign & Subtitles    │  │
│  │ • Anomaly Mgr   │ │ • KeyLook & │──┼─▶│ • PolaroidViewfinder & Album    │  │
│  │   (Off-Gaze 13) │ │   Walk/Whip │  │  │ • EvpRecorder & TapePlayButton  │  │
│  │ • Passenger/Gaze│ │ • TouchStick│  │  │ • RouteSelector (G / L / 7)     │  │
│  │ • Polaroid/EVP  │ └─────────────┘  │  │ • TutorialCoach & Hint Strip    │  │
│  │ • Route/Endings │                  │  └─────────────────────────────────┘  │
│  └────────┬────────┘                  │                                       │
│           ▼                           │  ┌─────────────────────────────────┐  │
│  ┌─────────────────────────────────┐  │  │   Synthesized Web Audio Engine  │  │
│  │  Three.js Procedural Renderer   │  │  │ • RideMusic (4-Stage Decay)     │  │
│  │ • 3-Car Consist (A, B, C)       │  │  │ • PauseMusic (Clean Arrangement)│  │
│  │ • Mom, Dad & 7 Archetypes       │  │  │ • Wordless Intercom & PA Lines  │  │
│  │ • Pooled Tunnel & 13 Stations   │  │  │ • EVP Signals (11 Canonical)    │  │
│  │ • Newtown Creek Trestle & Trial │  │  │ • Door Chimes, Rail & Ducking   │  │
│  │ • On-Demand GlitchPass & Shake  │  │  └─────────────────────────────────┘  │
│  └─────────────────────────────────┘  │                                       │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

#### Canonical Data Model Specification

1. **Segment Table (14 Stretch Entries: Stops 2 through 13, including Stop 6b)**:
   - **Stop 1 (Hoyt–Schermerhorn)**: Origin boarding (`CHAPTER I — THE DESCENT`).
   - **Ride into Stop 2 (Fulton St)**: `1` anomaly, `real` stop, door tell: none, `chat 0` (or swapped calm small talk).
   - **Ride into Stop 3 (Clinton–Washington Avs)**: `1` anomaly, `real` stop, door tell: none, `mask check`.
   - **Ride into Stop 4 (Classon Av)**: `1` anomaly, `False Stop (forgiving)`, door tell: `doors open early`, `chat 1`.
   - **Ride into Stop 5 (Bedford–Nostrand Avs)**: `1` anomaly, `real` stop, door tell: none, `mask check`, `whisper`.
   - **Ride into Stop 6 (Myrtle–Willoughby Avs)**: `1` anomaly, `Safe Haven` (`CHAPTER II — SIGNAL DRIFT`), door tell: none, `chat 2`, Dad hands over grandfather's tape recorder (`+15` Sanity).
   - **Ride into Stop 6b**: `0` random anomalies (forced *Route Map Error*), `False Stop`, door tell: `lights flicker`, `silent`, `thin`, `13 s cruise`.
   - **Ride into Stop 7 (Flushing Av)**: `2` anomalies, `real` stop, door tell: none, `mask check`, `crowd`.
   - **Ride into Stop 8 (Broadway)**: `2` anomalies, `real` stop, door tell: none, `2 mask checks`, `crowd`.
   - **Ride into Stop 9 (Metropolitan Av)**: `1` anomaly, `False Stop`, door tell: `doors open early`, PA lie: `"This is Court Square. Last stop. Everybody off the train."`, `chat 3`.
   - **Ride into Stop 10 (Nassau Av)**: `1` anomaly (forced parent anomaly), `real` stop, door tell: none, `mask check`.
   - **Ride into Stop 11 (Greenpoint Av)**: `0` anomalies, `real` stop (`CHAPTER III — OPERATION SKYWARD` / `THE LAST STRETCH`), door tell: none, **Restraint**, `chat 4`.
   - **Ride into Stop 12 (21 St)**: `1` anomaly (forced critical), `False Stop (bait)`, door tell: `lights flicker`, `mask check`, open-air elevated station & Newtown Creek trestle transition.
   - **Ride into Stop 13 (Court Sq)**: `0` anomalies, `final` stop, door tell: none, `16 s cruise`, `exit choice`.

2. **The 13 Canonical Anomalies & Verbatim Psych Log Definitions**:
   - **Class I (High Tier)**:
     1. *The Misprint*: `"The ${ad} ad had a typo: "${swapped}""` (`E↔F, O↔Q, N↔M, C↔G, I↔L, R↔P`) · Note: `"One letter in an overhead ad changed while you weren’t looking. Small enough to doubt."`
     2. *Window Residue*: `"A bright yellow smiley sticker appeared on a window"` / `"A grimy liquid drip stain formed on a window"` · Note: `"Something appeared on the glass between stops. Nobody saw it get there."`
     3. *The Cold Panel*: `"One ceiling fluorescent light turned cold sterile blue"` · Note: `"One ceiling tube turned a hospital blue. It lit the same car. It didn’t feel like the same car."`
     4. *The Man Across the Aisle* (`mta` archetype): `"The man sitting across the aisle stared directly at you without blinking"` · Note: `"He stopped blinking. He didn’t look away when you did."`
   - **Class II (Medium Tier)**:
     5. *Route Map Error*: `"The route map showed an impossible station: "Hollow St""` / `"The G train line on the route map shifted to the wrong color"` · Note: `"The strip map disagreed with itself. Sometimes it lists Hollow St. There is no Hollow St."`
     6. *Color Drift*: `"The ${ad} advertisement shifted its background color"` · Note: `"An ad’s background changed between glances. The words stayed exactly where they were."`
     7. *The Relocated Passenger* (`puffer` archetype): `"The standing passenger was abruptly standing at the far doors"` · Note: `"A standing passenger was at the far doors without crossing the car. No one saw them walk."`
     8. *The Additional Passenger*: `"An unrecognized silent passenger was suddenly seated at the far end"` · Note: `"A silent rider sat at the far end. They didn’t board at any stop you remember."`
   - **Class III (Low Tier)**:
     9. *Warped Copy*: `"The ${ad} ad warped into disturbing words: "${warp}""` (`GREENPOINT SAVES US`, `KESSLER DENIAL`, `HALLORAN MATTERS`, `LEARN A TRACE`, `COURTESY COUNTS DOWN`) · Note: `"An ad rearranged itself into words that were meant for you."`
     10. *The Woman on Your Bench* (`coat` archetype): `"The woman on your bench twisted her neck beyond anatomical limits to look at you"` · Note: `"Her head turned further than a neck allows. She wanted to see your reaction."`
   - **Class IV (Critical Tier — triggers screen glitch tear on manifestation)**:
     11. *Mom, Fixed*: `"Mom’s face froze into an uncanny expression with unnervingly dilated eyes"` · Note: `"Her face set into an expression that wasn’t hers, pupils wide. She kept talking as if nothing had changed."`
     12. *Dad, Answering*: `"Dad answered an unspoken thought aloud: "${line}""` (`"No, I didn’t hear it either."`, `"Because you didn’t ask."`, `"Two more. Don’t count them."`) · Note: `"He replied to something you only thought."`
     13. *The Empty Car*: `"Every single stranger vanished; the train car was completely empty"` · Note: `"Every stranger was gone at once. Your parents didn’t mention it."`

3. **The 8 Priority-Ordered Endings (`endings.ts`)**:
   - **1. The Unbroken Mask** (`[SECRET: THE UNBROKEN MASK]`): `peakSuspicion === 0`.
   - **2. The Eternal Commute** (`[LOOP: THE ETERNAL COMMUTE]`): Stepped off at 21 St bait (Stop 12) OR `sanityRetained < 30%`. Report primary CTA: `"Get back on"`.
   - **3. Midnight Terminal** (`[BRANCH: SIGNAL ARCHIVIST]`): Exit === `lower_level` AND `tapesRecorded.length >= 2` AND `anomalyAccuracy >= 75%` AND `peakSuspicion <= 30`.
   - **4. Skyward Catwalk** (`[BRANCH: SKYWARD VOID]`): Exit === `surface_hatch` AND `restraintHeld === true` AND `falseStopTrials.length === 0` AND `interventions === 0`.
   - **5. Dawn Horizon** (`[BRANCH: DAWN HORIZON]`): Exit === `escalators` AND `restraintHeld === true` AND `falseStopTrials.length === 0` AND `hasConductorOnTape === true` AND `sanityRetained >= 60%`.
   - **6. Exposed** (`[TERMINAL: EXPOSED]`): `interventions > 0`.
   - **7. Disoriented Collapse** (`[COLLAPSE: DISORIENTED]`): `falseStopTrials.length > 0`.
   - **8. Civilian Extraction** (`[STANDARD: EXTRACTION]`): Fallback when none of the above match.

4. **8 Canonical Achievements**:
   - *First Contact*, *Silver Halide Evidence*, *Signal Hunter* (`>= 3` distinct radio signals), *Phantom Broadcaster* (secret station broadcaster frequency), *The Unbroken Mask* (`0` peak suspicion), *Night Watch* (Newtown Creek trestle crossing), *Loop Breaker* (any non-Civilian Extraction escape ending), *Chief Archivist* (`>= 6` distinct anomaly types documented).

#### Phased Milestone Order (One Milestone at a Time)

1. **Milestone 1 — Skeleton**: Vite + TS + Three.js + React 19 overlay shell, renderer with software-WebGL guard & 90-frame performance governor, settings store (`localStorage`), and Start Screen (`lint` & `build` pass; 60 fps scene).
2. **Milestone 2 — Car & Movement**: Procedural 3-car consist (Cars A, B, C), gangways, pooled warm fluorescent lights, fog, `pointerLock.ts` (`rawMouse` with fallback, `quiet` unlock, error hint), keyboard/touch look, and `smoothWalking` toggle.
3. **Milestone 3 — Ride Motion**: Pooled tunnel streaming toward `+x`, 13 stations with procedural canvas signs (including 21 St elevated variant), doors + arrival tick, analog rollsign, route line switcher (**G**, **L**, **7 Ghost Line**), and data-driven segment table (including Stop 6b).
4. **Milestone 4 — Characters & Watching**: Procedural Mom, Dad, and 7 passenger archetypes (`mta`, `coat`, `puffer`, `hoodie`, `texter`, `overcoat`, `office`) with slerped head turns, parent gaze cone detection, head-whip detection, canonical v5.3 dialogue + mask checks, and sanity/suspicion band rules.
5. **Milestone 5 — Anomalies & Flags**: All 13 canonical anomaly types with off-gaze manifestation rules, `0.7s` `F`-key flagging raycast, ad copy mutations, and persistent Psychological Log.
6. **Milestone 6 — Stops Logic**: False Stops + multi-stage Trial room scene, Stop 6 Safe Haven + grandfather's recorder handoff, Stop 6b flicker false stop, Stop 9 PA lie, Stop 11 Greenpoint Av restraint (`Space` + `2.5s` grace), Stop 12 21 St bait, and Newtown Creek open-air trestle scene.
7. **Milestone 7 — Tools**: Polaroid 600 camera (`C`) + viewfinder & developing prints, EVP tape recorder (`R`, `[` `]` / wheel tuning, `Space` to record, 11 canonical signals + carrier tones, parent visibility reaction), Evidence Log (`Tab`), and Route Selector (`L`).
8. **Milestone 8 — Endings & Report**: All 8 priority-ordered endings with exact v5.3 thresholds, Court Sq exit choice, Report screen, Case Files modal, 8 Achievements, Nightmare mode, and Chapter II/III non-saving practice runs.
9. **Milestone 9 — Audio**: Synthesized Web Audio engine—4-stage decaying speaker tune, clean pause tune, wordless pitch-warbling background intercom, spoken PA lines, rail ambience, door chimes, heartbeat, EVP voices/carriers, tape playback, and dynamic ducking.
10. **Milestone 10 — Polish**: On-demand GlitchPass, sanity-tier inhale FOV breathing, camera shake + cover scale, Android haptics, interactive Practice Stretch tutorial + coach, reduced-motion accessibility, and MacBook Air 60 fps verification.
11. **Milestone 11 — Builds & Tests**: Web chunked build, `build:offline` single-file `index.html` + `README.txt` packaged into `Last-Local-offline.zip`, and Playwright E2E test suite (including offline test with network blocked).
