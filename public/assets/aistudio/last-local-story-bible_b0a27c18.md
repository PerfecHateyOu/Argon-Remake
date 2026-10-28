**Argon: this is the canonical LAST LOCAL v5.3 text, taken verbatim from the current build. Use it word for word; don't rewrite or invent lines.**

Notes on format: `{terminus}`, `{origin}`, `{line}`, `{s10}` etc. are route placeholders filled with the current line's stop names (on the G: terminus = Court Sq, origin = Hoyt–Schermerhorn). `${...}` marks a value filled in at runtime. `<b>` / `<em>` mark bold speaker names and italic stage directions in subtitles. "0" = Mom, "1" = Dad in the dialogue tables.

## 1. Title and pitch
- Name: **LAST LOCAL: A Liminal Subway Horror Game**
- Description: "Every stop takes you further from home. A first-person liminal horror ride on the NYC G train: spot subtle anomalies, keep your composure in front of your parents, and learn which doors are safe."
- README: "A first-person liminal horror ride on the NYC G train, from Hoyt–Schermerhorn to Court Square, 13 stops, with your parents. Notice what changes in the car, hide that you noticed, and learn which doors are safe."
- Start screen subtitle: "A Liminal Subway Horror Game" / "LAST LOCAL — to Court Sq"

## 2. Characters
- **You** — the rider (first person, unnamed).
- **Mom** (label "Mom") — sits with you; her skin/face is the target of the "Mom, Fixed" anomaly.
- **Dad** (label "Dad") — wears glasses; gives you "your grandfather's" tape recorder at the Safe Haven.
- **The man across the aisle** — archetype mta: "MTA maintenance worker: navy uniform, hi-vis vest, hard hat".
- **The woman on your bench** — archetype coat: "burgundy knee-length coat, small dark hat, canvas tote in one hand".
- **The standing passenger** — archetype puffer: "bulky puffer jacket, over-ear headphones".
- **The seat at the far end** — the Additional Passenger appears here.
- **A passenger in the aisle** — hoodie: "navy hoodie, white headphones over a beanie, baggy jeans, backpack".
- **A passenger at the end** — texter: "navy puffer, phone held up at the chest, backpack, hair in a bun".
- **A passenger behind you** — overcoat: "long dark overcoat over a black turtleneck, slicked hair; very still".
- Other archetype: office — "grey dress shirt and tie, messenger bag, folded newspaper".
- **The conductor** (PA voice), **Dispatch** and other voices on the recorder (see section 9).

## 3. Route, stops, chapters
Stops (G): 1 Hoyt–Schermerhorn, 2 Fulton St, 3 Clinton–Washington Avs, 4 Classon Av, 5 Bedford–Nostrand Avs, 6 Myrtle–Willoughby Avs, 7 Flushing Av, 8 Broadway, 9 Metropolitan Av, 10 Nassau Av, 11 Greenpoint Av, 12 21 St, 13 Court Sq.

Chapters (announced by the rollsign as "CHAPTER N: TITLE — subtitle"):
- CHAPTER I — THE DESCENT (stops 1–5)
- CHAPTER II — SIGNAL DRIFT (stops 6–10)
- CHAPTER III — OPERATION SKYWARD (stops 11–13); on the L and 7 lines: THE LAST STRETCH

Route lines (Route selector):
- **G Brooklyn–Queens Crosstown** — "The ride as it was meant: Brooklyn to Queens, climbing out over Newtown Creek before Court Sq."
- **L 14th St–Canarsie Express** — "The same ride on the L's stations, 8th Av to Myrtle–Wyckoff. It never leaves the tunnel." Stops include Union Sq–14th St, Bedford Av, Lorimer St, Graham Av, Grand St, Montrose Av, Morgan Av, Jefferson St, Myrtle–Wyckoff Avs.
- **7 Ghost Line (Abandoned Spur)** — "The same ride on stations no map shows, Times Sq to Terminal Echo. It never leaves the tunnel." Stops include Times Sq–42nd St, 5th Av–Bryant Pk, Grand Central, Abandoned Steinway Platform, Hunters Point Depths, Vernon–Jackson Void, Sunken Yard Switch 9, Dead Track Gantry, Queensboro Cavern, Rawlings Switch, Court Sq Tower Vault, Terminal Echo.
- Fallback names: "a street none of you can name", "a neighborhood none of you recognize", "Track Marker ${stopIndex}".
- Route selector text: "Switching renames the stops and announcements ahead, from now on. Every new ride starts on the G."

### Stop-by-stop rules (segment table)
| Ride into stop | Anomalies | Stop type | Door tell | Other |
|---|---|---|---|---|
| 2 | 1 | real | — | chat 0 |
| 3 | 1 | real | — | mask check |
| 4 | 1 | **False Stop** (forgiving) | doors open early | chat 1 |
| 5 | 1 | real | — | mask check, whisper |
| 6 | 1 | **Safe Haven** | — | chat 2 |
| 6b | 0 (forced Route Map Error) | **False Stop** | lights flicker | silent, thin, 13 s cruise |
| 7 | 2 | real | — | mask check, crowd |
| 8 | 2 | real | — | 2 mask checks, crowd |
| 9 | 1 | **False Stop** | doors open early | PA lie: "This is Court Square. Last stop. Everybody off the train." chat 3 |
| 10 | 1 (forced parent anomaly) | real | — | mask check |
| 11 Greenpoint Av | 0 | real | — | **Restraint**, chat 4 |
| 12 21 St | 1 (forced critical) | **False Stop (bait)** | lights flicker | mask check |
| 13 Court Sq | 0 | final | — | 16 s cruise, exit choice |

## 4. Dialogue

### Parents' chats on the ride (pairs; 0 = Mom, 1 = Dad)
- Chat 0 — Dad: "Did you ever call your sister back?" / Mom: "Tonight. Remind me."
- Chat 1 — Mom: "Your cousin’s gonna be so tall now." / Dad: "Everybody’s tall now."
- Chat 2 — Dad: "We should’ve taken the bus." / Mom: "The bus takes forever."
- Chat 3 — Mom: "Did you ever call your sister back?" / Dad: "Did you ever call your sister back?"
- Chat 4 — Dad: "Is it always this empty?" / Mom: "It’s always this empty."

Extra calm small talk (swapped into the rides into stops 2, 4 and 6):
- Mom: "Don’t lean against the doors." / Dad: "Should be in Queens in twenty minutes."
- Mom: "Did they change the schedule?" / Dad: "It feels slower today."
- Mom: "I always hated this curve." / Dad: "Check your bag."

### Mask checks (parent's question → calm answer | two "off" answers)
Lines marked DRAFT in the code are flagged so here too.

**High tier (Calm set)**
- Mom: "You've been quiet. You okay, hon?" → "Yeah, just tired." | "Why? Do I look weird?" / "Did the lights just change?"
- Dad: "How many more stops, you think?" → "A few. We’re fine." | "Why are you asking me?" / "Wait, which train is this?"
- Mom: "Did you eat anything today?" → "Had a bagel earlier." | "Why does everyone keep asking that?" / "Sorry, what?"
- Mom: "You look warm. Are you warm?" → "Just stuffy in here." | "Is it hot to you?" / "Stop looking at me like that."
- Dad (only when Suspicion is up): "You’re staring at something." → "Just zoning out." | "No I’m not." / "Don’t you see it?"
- Mom: "Did you drop something on the floor?" → "No, just adjusting my bag." | "Why are you staring?" / "Leave me alone."
- Dad: "You want the window seat?" → "Nah, I’m good here." | "Why, what’s out there?" / "Don’t make me move." (DRAFT)
- Mom: "Text your aunt we’re on the train." → "Sending it now." | "There’s no signal down here." / "Which train do I tell her?" (DRAFT)

**Medium/Low tier (Uneasy set)**
- Dad: "You’d tell us if something was wrong, right?" → "Of course." | "Would you tell me?" / "Define wrong."
- Mom: "Why do you keep looking over there?" → "Thought I saw someone I knew." | "You saw it too?" / "Over where?"
- Dad (only when Suspicion is up): "You’re staring at something." → "Just zoning out." | "No I’m not." / "Don’t you see it?"
- Mom: "You’re holding that pole awfully tight." → "Train’s bumpy tonight." | "Because it keeps moving." / "Don’t let go of yours." (DRAFT)
- Dad: "You didn’t say a word that whole stop." → "Just tired, Dad." | "Was it a stop?" / "Nobody got on." (DRAFT)
- Mom: "Is your stomach bothering you again?" → "A little. It’ll pass." | "It’s not my stomach." / "Can you feel that too?" (DRAFT)
- Dad: "Put your phone away and talk to us." → "Okay, okay. It’s away." | "It stopped showing the time." / "About what?" (DRAFT)
- Mom: "You’re counting the stops again, aren’t you?" → "Habit. Sorry." | "Someone has to." / "We passed this one already." (DRAFT)

**Critical tier (Wrong set)**
- Mom: "You can see it too, can’t you?" → "See what?" | "Yes." / "Don’t."
- Dad: "We’re not getting off. You know that." → "I know." | "Why would you say that?" / "Who said we were?"
- Mom: "Who are you looking for?" → "Nobody. Just looking." | "The people who were here." / "You."
- Dad: "Sit still. They notice when you fidget." → "Okay. Sitting still." | "Who notices?" / "You noticed." (DRAFT)
- Mom: "We’ve always taken this train, sweetie." → "Right. I know." | "Since when?" / "There’s no always down here." (DRAFT)
- Dad: "Don’t look at the windows. Look at me." → "I’m looking at you." | "What’s in the windows?" / "Your face is wrong." (DRAFT)
- Mom: "Smile for me, hon. Like you used to." → "Like this?" | "I don’t remember how." / "You first." (DRAFT)
- Dad: "Nobody gets off at this one. Remember?" → "I remember." | "Then why do the doors open?" / "Who told you that?" (DRAFT)

### Paranoid UI words (flash on screen at low sanity)
"they’re not your parents" · "don’t answer" · "it’s watching you" · "wrong wrong wrong" · "who is she" · "get off get off" · "you saw it" · "SAY NOTHING"

### Ride, stop and event lines (from the game engine)
- …stand clear of the closing doors…
- …next stop… transfer available…
- …held momentarily by the dispatcher…
- Hold the button again. Don’t react.
- Hold Space again. Don’t react.
- This is the Last Local. {terminus}–bound {line} train.
- Drag to look around. Hold FLAG while looking at anything that changes.
- Move the mouse to look. Hold F while looking at anything that changes.
- Grab a seat. It’s a long one.
- He said that last time, too.
- Stand clear of the closing doors, please.
- You have Dad’s tape recorder. Tap Recorder to raise it.
- You have Dad’s tape recorder. Press R to raise it.
- {terminus}. This is the last stop on this train.
- Stop ${seg.stop} anomalies
- Clean stop
- Here we are. {terminus}.
- This is us. Come on, get up.
- Step off
- Follow Mom and Dad to the escalators
- Follow the static down the side stairs
- Push through the emergency door
- <em>You follow your parents toward the escalators.</em>
- <em>You drift toward the side stairs. The hiss in your pocket gets louder.</em>
- <em>You lean on the emergency bar. Somewhere above, the air is moving.</em>
- Stepped off at a real stop
- Hey! Where are you going? Get back in here.
- Refused to step off when your parents asked
- You don’t want to stretch your legs? …Okay.
- Stepped off at a False Stop
- <em>Mom grabs your sleeve.</em> <b>Mom:</b> Not this one, hon. The doors opened funny.
- Feels good to stand up, right?
- Couple more stops after this. Then {terminus}.
- Safe Haven
- <em>You get back on with them.</em>
- Here. Your grandfather’s. He used it on the night shift. Never could get it to stop picking up the radio.
- Here, hold onto this. Your grandfather’s old recorder. Never could get it to stop picking up the radio.
- Dad gave you a tape recorder. Tap Recorder to raise it.
- Dad gave you a tape recorder. Press R to raise it.
- You don’t have anything to record with.
- Hesitated when ${p.label} asked a question
- Mask timeout
- <em>You don’t answer fast enough.</em> <b>${p.label}:</b> Hon?
- Gave an odd answer to ${p.label}
- Mask fail
- <em>${p.label} keeps looking at you.</em>
- Hey. Look at me. Both of us, right now.
- Talk to us. What is going on with you?
- Concerned Intervention
- Concerned Intervention (suspicion reset to 40)
- Hold the button. Don’t let go. Don’t react.
- Hold Space. Don’t let go. Don’t react.
- You couldn’t keep it together
- You let go
- (her mouth doesn’t move)
- Restraint held
- <em>The lights come back. Everyone is where they were.</em>
- Lost your composure during the restraint moment
- Restraint failed
- <em>You flinch. Dad sees it.</em>
- Find the way back. The signs lie. Watch the lights when the chime plays.
- To {terminusSign} trains
- To {opposite} trains
- Left stairs
- Right stairs
- Middle stairs
- Board the left train
- Board the right train
- <em>The stairs go down to another platform.</em>
- <em>You come out at the platform edge. Two trains are coming.</em>
- <em>The stairs bring you back up onto the same platform. It’s quieter now.</em>
- <em>The doors close on nothing. You’re back on the stairs.</em>
- Returned from a False Stop Trial
- <b>Mom:</b> Where did you go?! You can’t just walk off like that!
- <em>You don’t remember getting back on.</em> <b>Mom:</b> Oh my god. Where were you?
- Sit. Stay where we can see you.
- Snapped your head around while ${watcher.label} was watching
- Stared at something wrong while ${watcher.label} was watching
- Held up a tape recorder while ${watcher.label} was watching
- Played a tape out loud while ${watcher.label} was watching
- I think this is our… let’s… stretch our legs.
- I think this is our transfer. Let’s stretch our legs.
- Answer first.
- Not now. Keep holding.
- Out of film.
- Took a flash photo while ${watcher.label} was watching

In-transit conductor PA (garbled, subtitled): "…stand clear of the closing doors…" · "…next stop… transfer available…" · "…held momentarily by the dispatcher…"

### Dad's unasked answers (the "Dad, Answering" anomaly; one is chosen, shown as "Dad: …")
- "No, I didn’t hear it either."
- "Because you didn’t ask."
- "Two more. Don’t count them."

## 5. Intercom and PA announcements
- The **background intercom has no words**: it is synthesized "distorted, unintelligible announcements … the rhythm and intonation of speech but no words." Sanity tier slows and lowers it "like tape slowing down, plus a warble that grows as sanity drops. Subtle at Medium, unmistakable at Critical." It plays at random times, not tied to stops.
- Spoken PA lines that do exist (same at every stop, with the stop name filled in): boarding "This is the Last Local. {terminus}–bound {line} train." · departure "Stand clear of the closing doors, please." · 7 s into each stretch "The next stop is ${stop}." · on arrival "This is ${stop}." · final "{terminus}. This is the last stop on this train." · Stop 9's lie "This is Court Square. Last stop. Everybody off the train."
- There is **no unique per-stop announcement script** in the code.

## 6. The 13 anomalies
How they work (all types): each appears only while you are **not looking at it** (it manifests when the camera is turned more than ~0.7 rad away, narrowing to 0.35 rad after 8 s and 0.2 rad in the last 3 s of the stretch). Small, read-up-close ones (typo, warped words, sticker, cold light) only happen within 5 m of your seat. **Detection:** look at it and hold Flag (F / FLAG button) for 0.7 s, or photograph it with the Polaroid. Which anomaly appears is drawn at random from your current sanity tier's pool (70% your tier, otherwise a lower one); Critical (tier 3) ones can't appear before stop 10, except where forced (6b forces Route Map Error, 10 forces a parent anomaly, 12 forces a critical one). Tier 3 anomalies tear the screen the moment they appear. They revert afterward.

| # | Case File title | Class | Report description (verbatim) | Case File note (verbatim) |
|---|---|---|---|---|
| 1 | The Misprint | I (High) | "The ${ad} ad had a typo: "${swapped}"" (one letter swapped, e.g. E↔F, O↔Q, N↔M, C↔G, I↔L, R↔P) | "One letter in an overhead ad changed while you weren’t looking. Small enough to doubt." |
| 2 | Window Residue | I | "A bright yellow smiley sticker appeared on a window" / "A grimy liquid drip stain formed on a window" | "Something appeared on the glass between stops. Nobody saw it get there." |
| 3 | The Cold Panel | I | "One ceiling fluorescent light turned cold sterile blue" | "One ceiling tube turned a hospital blue. It lit the same car. It didn’t feel like the same car." |
| 4 | The Man Across the Aisle | I | "The man sitting across the aisle stared directly at you without blinking" | "He stopped blinking. He didn’t look away when you did." |
| 5 | Route Map Error | II (Medium) | "The route map showed an impossible station: "Hollow St"" / "The G train line on the route map shifted to the wrong color" | "The strip map disagreed with itself. Sometimes it lists Hollow St. There is no Hollow St." |
| 6 | Color Drift | II | "The ${ad} advertisement shifted its background color" | "An ad’s background changed between glances. The words stayed exactly where they were." |
| 7 | The Relocated Passenger | II | "The standing passenger was abruptly standing at the far doors" | "A standing passenger was at the far doors without crossing the car. No one saw them walk." |
| 8 | The Additional Passenger | II | "An unrecognized silent passenger was suddenly seated at the far end" | "A silent rider sat at the far end. They didn’t board at any stop you remember." |
| 9 | Warped Copy | III (Low) | "The ${ad} ad warped into disturbing words: "${warp}"" | "An ad rearranged itself into words that were meant for you." |
| 10 | The Woman on Your Bench | III | "The woman on your bench twisted her neck beyond anatomical limits to look at you" | "Her head turned further than a neck allows. She wanted to see your reaction." |
| 11 | Mom, Fixed | IV (Critical) | "Mom’s face froze into an uncanny expression with unnervingly dilated eyes" | "Her face set into an expression that wasn’t hers, pupils wide. She kept talking as if nothing had changed." |
| 12 | Dad, Answering | IV | "Dad answered an unspoken thought aloud: "${line}"" | "He replied to something you only thought." |
| 13 | The Empty Car | IV | "Every single stranger vanished; the train car was completely empty" | "Every stranger was gone at once. Your parents didn’t mention it." |

### Ad copy (normal → warped, for Misprint / Color Drift / Warped Copy)
Across the aisle:
- GREENPOINT SAVINGS → **GREENPOINT SAVES US** — "Your money. Closer to home." — "Branches in Brooklyn and Queens"
- KESSLER DENTAL → **KESSLER DENIAL** — "Smile like you mean it." — "New patients welcome, evenings too"
- HALLORAN MATTRESS → **HALLORAN MATTERS** — "Sleep like nothing's wrong." — "Free delivery to Brooklyn and Queens"
- LEARN A TRADE → **LEARN A TRACE** — "Night classes at Borough Tech." — "Electrical, HVAC, welding, carpentry"
- COURTESY COUNTS → **COURTESY COUNTS DOWN** — "Offer your seat to someone who needs it." — "A message from your fellow riders"

Near your seat (no warp):
- MIDNIGHT DINER — "Open until the last train." — "Myrtle and Willoughby"
- TAX HELP NOW — "Walk-ins welcome, fast filing." — "Court Sq, second floor"
- SEE A DOCTOR TODAY — "Same-day visits, most insurance." — "Clinics near every G stop"
- READ MORE — "Your library card is completely free." — "Brooklyn Public Library"

## 7. The 8 endings (checked in this priority order)
Thresholds: "composure intact" = peak Suspicion ≤ 30 (half the 60 intervention threshold). Exit choice at Court Sq: "Follow Mom and Dad to the escalators" (escalators), "Follow the static down the side stairs" (lower level), "Push through the emergency door" (surface hatch). Default exit is escalators.

1. **The Unbroken Mask** — badge "[SECRET: THE UNBROKEN MASK]". Condition: peak Suspicion 0. Text: "At {terminus}, Mom takes your hand on the escalator. “You can stop pretending now,” she says, not looking at you. “We saw it too.”" Summary: "The whole ride without a single visible reaction (peak Suspicion 0)."
2. **The Eternal Commute** — "[LOOP: THE ETERNAL COMMUTE]". Condition: stepped off at the 21 St bait (stop 12) OR Sanity Retained < 30%. Text: "The doors open. The sign says {origin}. Mom stands up and smooths her coat. “This is us,” she says." Summary: "Stepped off at {bait}, or let too much of yourself slip away (Sanity Retained under 30%)." Report button: "Get back on".
3. **Midnight Terminal** — "[BRANCH: SIGNAL ARCHIVIST]". Condition: lower-level exit, ≥2 tapes, anomaly accuracy ≥75%, peak Suspicion ≤30. Text: "You descend past the rusted chain-link gate into {terminus}’s abandoned lower level. The microcassette recorder crackles to life on its own in the damp darkness. A calm dispatcher voice speaks through the hiss: “Track 4 clear. All units hold position.” The loop is broken." Summary: "Followed the static down the side stairs, with tapes in hand, most anomalies caught, and your composure intact."
4. **Skyward Catwalk** — "[BRANCH: SKYWARD VOID]". Condition: surface-hatch exit, restraint held, no False Stop Trials, no interventions. Text: "You break away through the emergency door and climb until there is open air. Below you, the sodium lights of the city glow in eerie silence, completely empty. Behind you, the train rumbles into the dark tunnel—its cars completely hollow." Summary: "Pushed through the emergency door after holding firm through the restraint, without a single False Stop or intervention."
5. **Dawn Horizon** — "[BRANCH: DAWN HORIZON]". Condition: escalators exit, restraint held, no Trials, the conductor tape recorded, Sanity Retained ≥60%. Text: "The doors open at {terminus} onto daylight that shouldn’t reach this platform. Dad squints and says nothing. For once, neither do you." Summary: "Stayed with your parents after holding firm through the restraint, with the conductor on tape and most of yourself intact."
6. **Exposed** — "[TERMINAL: EXPOSED]". Condition: any intervention. Text: "You made it to {terminus}. Dad keeps a firm, unyielding grip on your shoulder all the way up the stairs into the street. Nobody says a single word." Summary: "Your parents stepped in."
7. **Disoriented Collapse** — "[COLLAPSE: DISORIENTED]". Condition: any False Stop Trial. Text: "You made it to {terminus}. Mom doesn’t let go of your sleeve until you’re outside on {street}. You have no memory of the last three stops." Summary: "Stepped off at a False Stop."
8. **Civilian Extraction** — "[STANDARD: EXTRACTION]". Condition: none of the above. Text: "You made it to {terminus}. Your parents push through the turnstiles, already arguing about where to eat in {area}." Summary: "An ordinary arrival."

## 8. Tutorial (practice stretch)

- Look around
- Things in the car change while you’re not looking. Turn away from the windows across the aisle for a moment.
- Don’t show it
- Mom is watching you. While a parent watches, staring at something or whipping your head around raises their Suspicion. Flagging is private: it never does.
- Read the doors
- At every stop you can stay on or step off. Watch the doors and listen.
- You’re ready
- That’s the practice stretch. Nothing in it counted. Your ride to Court Square starts now.
- <b>Mom:</b> You okay, hon? You look pale.
- Just tired.
- Did that window just change?
- Someone keeps staring at us.
- <b>You:</b> Just tired. <em>(Mom nods.)</em>
- Good. Answer like nothing is wrong, even when something is.
- Too slow. On the ride, hesitating raises Suspicion too. Answer like nothing is wrong.
- <em>Mom keeps looking at you.</em>
- On the ride, that would raise her Suspicion. Give the ordinary answer, even when something is wrong.
- A real stop
- Listen: the chime plays, and the doors open after it finishes.
- A False Stop
- Now the doors open before the chime finishes. That’s the tick.
- Or the lights flicker once, hard, as the train arrives. That’s the other tick.
- The tick never lies
- Stepping off is a trap unless it’s a real stop your parents lead you to. They’re usually right, but not always: when you hear or see the tick, stay on.
- Good. You can turn all the way around in your seat, too.
- That’s it: a sticker that wasn’t there. Here we tell you. On the ride we won’t: flags are private, and you see how you did on the report at the end.
- Not that. Look for something new on the windows across the aisle.

### Tutorial coach and control hints
- Start the ride
- Practice stretch
- · ${step}
- or press Enter
- Click in the train, then move the mouse (or use the arrow keys)
- Drag the screen
- Hold the FLAG button
- Tap a choice
- Hold steady
- Hold Space when told to
- Hold the button when told to
- Camera button
- Recorder button
- Evidence log
- Evidence button
- Walk between cars
- WALK stick, bottom left
- Esc or P
- Pause button
- Sound button

## 9. Tape recorder (EVP) signals — title, then what it says
- Dispatch, track 2
- …{line} four-forty, hold at {s10}. Hold. Do not open the doors at {s10}…
- A passenger
- …I got on at {originShort} too. I always get on at {originShort}. I always get on at {originShort}…
- Dispatch, no train number
- …there is no train scheduled on this track. Repeat: nothing is scheduled on this track…
- Someone at the far end
- …first time? It gets easier after {s11}. Don’t let them see you looking…
- Static, then a time
- …6:52… 6:52 a.m.… it was 6:52 the last time, too…
- The conductor
- …this is your conductor. We are above ground. This train does not go above ground…
- …this is your conductor. We are under the river. This train does not go under the river…
- A voice like Mom’s
- …honey, don’t look at the window. Look at me. Look at me…
- {s5} dispatch static
- …Dispatch 44 to all units on {line}… relay failure at {s5}. Unauthorized personnel on track bed… repeat: do not look at track bed…
- {s4} phantom PA echo
- …Please stand clear of the closing doors… the train following this one does not exist… return to your seat immediately…
- {s7} night wiretap
- …Station log 02:14. Platform empty, but footsteps continue down the south stairs. Someone is whistling the wrong chime…
- Newtown Creek emergency channel
- Track emergency channel
- …Maritime security channel 16. Bridge clearance confirmed. Unscheduled train visible on upper trestle. Who authorized that train…
- …Track security channel 16. Signals confirmed. Unscheduled train visible on a closed track. Who authorized that train…

### Recorder UI
- Saved to tape: ${savedTitle}
- — a carrier tone, no voice —
- Recording hiss…
- Tune slowly. Something is out there.
- Nothing comes through at a standstill.
- Not recording
- Lower recorder
- Signal meter
- Locked on
- Tune down 5 kHz
- Tune down
- Tune up 5 kHz
- [ ] or wheel to tune · hold Space to record · R to lower
- Stop tape: ${tape.title}
- Play tape: ${tape.title}

## 10. Achievements (name, then description)
- First Contact
- Catch your first anomaly with a flag or Polaroid photo.
- Silver Halide Evidence
- Successfully photograph an active car anomaly with the Polaroid 600.
- Signal Hunter
- Record at least 3 distinct radio signals on the microcassette recorder.
- Phantom Broadcaster
- Discover and record a secret station broadcaster frequency.
- The Unbroken Mask
- Complete a full ride with 0 peak suspicion from your parents.
- Night Watch
- Witness the Newtown Creek trestle crossing into the night sky.
- Loop Breaker
- Unlock any alternative escape ending beyond standard Civilian Extraction.
- Chief Archivist
- Catalog and document at least 6 distinct anomaly types in your case files.

## 11. Polaroid text
- OUT OF FILM
- POLAROID 600 VIEW
- Lower Camera
- 600 INSTANT CARTRIDGE
- SNAP PHOTO
- Undeveloped print
- Develops after the ride
- Evidence Log
- Close Album
- POLAROIDS (${photos.length})
- TAPES (${tapes.length})
- No tapes yet.
- "Tap the recorder" (touch) or "Press R" (keyboard), then: to raise it, tune slowly, and hold record when something comes through.
- You don’t have anything to record with.
- No prints from this car.
- No Polaroids yet.
- Tap Camera
- Polaroid Evidence
- Nothing out of place
- A (Lead)
- C (Rear)
- Close photo
- Selected Evidence
- NOTHING OUT OF PLACE
- STILL DEVELOPING
- CONSIST CAR LOCATION
- Car A (Lead)
- Car C (Rear)
- Car B (Mid)
- MTA TRANSIT LINE
- Evidentiary photo captured on Polaroid 600 emulsion.
- Polaroid 600 prints take their time. This one will be ready at the end of the ride.
- Undeveloped print
- Nothing out of place.

## 12. Case Files
- Close Case Files
- Case Files sections
- Nothing witnessed yet. Anomalies you see on a ride are filed here.
- Class ${cls}, not yet witnessed
- Seen, not flagged in time.
- No Polaroids yet
- Tap Camera
- Polaroid at stop ${photo.stop}
- SILVER PRINT
- Anomaly Caught
- Standard Car
- Carrier Wave
- Undocumented Outcome
- Not yet earned.
- Enlarged polaroid
- Undeveloped Silver Print
- Verified Anomaly Evidence
- Routine Commute
- No unusual phenomena detected in frame.

## 13. Report screen
- The tell: the doors opened early, and the announcement lied.
- The tell: the doors opened early, with no announcement.
- The tell: the lights flickered as you pulled in.
- Mom said it was your transfer. She was wrong. The doors weren’t.
- Mom said "This is us." She was wrong. The lights weren’t.
- STATUS: NOT FILED
- How well you held on, stop by stop: where your sanity sat inside each stop's band, averaged over the ride.
- Sanity Retained
- +${RESTRAINT_RAISE} restraint bonus
- How well you hid it: the highest your parents' Suspicion got this ride. Lower is better.
- Mask Integrity
- They never suspected a thing.
- Anomalies you flagged or photographed in time, out of all that appeared.
- Anomaly Accuracy
- Restraint (Stop 11)
- Held (Composure Maintained)
- False Stop Trials
- Stop ${t.stop} (${t.depth} loops deep)
- None. You never stepped off into a trap.
- Safe Haven
- False Stop
- Real Stop
- Stepped off
- Caught on film
- The anomalies you've seen: this ride's, then the whole file kept on this device (the same file as Case Files → Anomalies).
- ${documented} of ${PSYCH_IDS.length} documented, ${unconfirmed} unconfirmed
- ${unconfirmed} witnessed but never caught.
- This ride
- Nothing happened in front of you this ride. That you know of.
- Case file
- Not yet witnessed.
- ${documentedEndingsCount} of ${ENDING_IDS.length} endings documented
- Undocumented Outcome
- Polaroid print
- Nothing out of place

## 14. HUD and status strings
- Evidence status chips: CAUGHT · DOCUMENTED · UNCONFIRMED · NOTHING
- Psych Log classes: I, II, III, IV
- GANGWAY COUPLING
- CAR A (LEAD)
- CAR C (REAR)
- CAR B (MID)
- Switch route line (L)
- ${currentRoute.id} train, next stop ${nextStopName}. Switch route line
- Camera (C)
- Polaroid Camera
- Tape recorder (R)
- Evidence log (Tab)
- Evidence Log
- Route lines (L)
- Route Lines
- Sound off (M)
- Sound on (M)
- Exit full screen
- Full screen
- Pause (Esc or P)
- PUSH GANGWAY DOOR
- Hold: don’t let go
- Flag: hold to catch
- don't let go
- hold to catch
- Walk: drag the stick
- Next approaching station:
- NIGHTMARE MODE
- Exit Full Screen
- Full Screen
- Add to Home Screen

## 15. Start screen
- A Liminal Subway Horror Game
- LAST LOCAL — to Court Sq
- Faster train, flickering tubes, sharper-eyed parents, faster sanity loss
- Nightmare mode
- Nightmare mode and chapter select: finish a ride to unlock
- Start from
- When something in the car changes, look at it and hold
- 2. Don't show it.
- 3. Read the doors.
- At every stop you can stay on or step off. Assume stepping off is a trap. Your parents usually know when to get off, but they can be wrong.
- The doors never lie.
- Keyboard and mouse

## 16. Settings panel
- Match device
- Following your device: On. / Following your device: Off.
- Always on.
- Close settings
- Look speed
- Invert vertical look
- Raw mouse input
- Uses your mouse's movement without the system's pointer acceleration, where the browser supports it. Applies the next time the mouse is captured.
- Smooth walking
- Walking speeds up and slows down gradually instead of starting and stopping at once. Same top speed.
- Show control hints
- The key strip along the bottom: all through your first ride, then for the first minute of each ride after.
- Game sounds
- Start rides muted
- Tap the sound button to turn it on.
- M turns sound on and off at any time.
- Vibrate for catches
- At each stop, a soft pulse for every anomaly you caught on the way in.
- Full screen when boarding
- Hides the browser's bars during the ride. Press Esc (or use the pause menu) to leave.
- Debug overlay (spoilers)
- Spoiler warning: shows hidden anomalies, sanity and suspicion. It shows during rides while this is on (` hides or shows it on a keyboard). Rides where it's shown are debug runs and save nothing.
- Nothing saved on this device yet.
- Erase everything saved on this device? This can’t be undone.
- finished ride
- Your settings are kept.

## 17. Route selector
- Close route selector
- Switching renames the stops and announcements ahead, from now on. Every new ride starts on the G.
- LAST LOCAL v5.2
- Active Line
- Switch Line

## 18. How to play (README text)
1. **Notice.** When something in the car changes, look at it and hold Flag. Flags are private.
2. **Don't show it.** Staring at something wrong, or whipping your head around, while a parent is looking at you raises their suspicion. When they talk to you, answer like nothing is wrong.
3. **Read the doors.** At every stop you can stay on or step off. Stepping off is usually a trap.

After the Safe Haven, Dad gives you his old tape recorder. Tune it and you'll pick up voices, and some carriers that are only tones. What it hears has nothing to do with what's wrong in the car, and holding it up where your parents can see is a reaction too.

