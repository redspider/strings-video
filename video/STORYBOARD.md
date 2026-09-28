# "Strings" — storyboard

**Story:** Juno (8) and her scruffy dog Biscuit launch a homemade test rocket, which blows up
(the song's deliberate false start). Sooty and undaunted, they "start again", build the S.S.
Biscuit, blast off, slingshot round a ringed planet, chase a comet (it's a baby star!), set it
free, and use the rocket's trail to string the stars into pictures — then float home to lie in
the backyard under the constellations they made.

**Motif:** *strings* — glowing lines connecting stars into pictures (the constellation helper in
`src/props/space.js`). Seeded in the title card, pays off in s12 and s16, echoes in s19.

## Music map (measured — 100.0 BPM, 4/4, bar = 2.400 s, bar k starts at 0.135 + 2.4·k)

| bars | time (s) | music |
|---|---|---|
| 0–1 | 0.14–4.94 | solo guitar picking (false start), faster run 4.06–4.94 |
| 2 | 4.94 | last note hits and rings out → decays; near-quiet until 9.1 |
| 3–6 | 9.12–15.54 | **spoken**: "ah sh—" 9.12–10.82 … "start again" 13.58–15.54 |
| 6–7 | 16.24–17.48 | **total silence** ("wait a beat") |
| 7 | 17.48 | guitar restarts (≈ beat 17.54) |
| 8 | **19.34** | **drums + bass come in** (kick every beat, snare on 2 & 4) |
| 12–14 | 28.94–35.52 | humming vocal |
| 15 | **36.14–38.54** | **bass drops out** (breakdown) |
| 16 | **38.54** | full band back |
| 17–22 | 41.4–43.4, 45.8–48.2, 50.4–57.7 | bass drops in and out |
| 23 | **55.34** | **drums drop out**; vocal "go where the gravity takes me" 55.61–58.3 |
| 24 | **57.74** | **DROP** — drums + bass slam back |
| 25–28 | 61.36–64.6, 65.79–69.0 | vocal "just me and the stars" (×2) |
| 31 | 74.54–76.94 | bass out (build) |
| 32–36 | **76.94–88.94** | **loudest section** |
| 37–39 | 88.94–96.14 | bass out (floaty build) |
| 40–43 | **96.14–105.74** | **peak**: vocals (humming) + full band |
| 44–46 | 105.74–112.94 | bass out, vocals continue to 111.7 |
| 47 | 112.94–115.34 | drums only |
| 48–51 | 115.34–124.94 | drums out — gentle guitar outro |
| 52 | **124.94** | final drum hit, then fade to black by 128 |

Beat times: bar k beat j (j = 0..3) = `barTime(k, j)`. E.g. bar 1 = 2.54, 3.14, 3.74, 4.34.

---

## Scenes

Times are absolute seconds. "b" = beat. The transition listed is set on the scene's
`transition` field (applies when entering that scene).

### s01_test_launch — 0.00 → 7.34 (bars 0–2) · transition: none (engine fades in)
Golden-hour backyard (`drawBackyard`, tod 'golden'). Test Rocket #1 on its crate pad (x≈1240).
Juno (x≈600, overalls, goggles on forehead, holding the **remote**), Biscuit sitting beside her.
* 0.14: establishing; slow camera push-in over bars 0–1. Biscuit's tail wags on beats.
* 0.74 (b1): Juno snaps goggles down over her eyes.
* 1.34 (b2): Biscuit flattens ears / covers them with paws.
* Countdown numbers pop big on beats: **"5" 1.94, "4" 2.54, "3" 3.14, "2" 3.74, "1" 4.34**
  (pop with overshoot, then shrink/fade before the next).
* 3.14→: rocket trembles; 3.74→ smoke puffs at its base; Juno presses the button on "1".
* 4.06–4.94 (fast guitar run): ignition — flame sputters, rocket lifts a little, wobbles drunkenly.
* **4.94 (bar 2 downbeat): KA-BOOM.** Big cartoon `explosion()` at the rocket, white flash,
  heavy camera shake decaying over ~1 s.
* 5.0–7.34: smoke engulfs the frame; debris (orange traffic-cone nose, cardboard fin,
  duct-tape roll, bolts) spins up and rains down in arcs; smoke thins toward 7.3 (hold the
  characters hidden in smoke until s02).

### s02_soot — 7.34 → 16.94 (bars 3–6) · transition: cut
Medium shot, smoke clearing. Juno and Biscuit are **fully soot-blackened** (`soot: 1`),
hair/fur **frizzed** (`frizz: 1`), goggles askew, a curl of smoke rising from Juno's hair.
Behind: wrecked pad, small crater, a few embers.
* 7.94 & 8.54 (beats): blink… blink — white eyes in black faces.
* **9.12 ("ah sh—", to 10.82):** Juno's mouth opens, a little smoke-ring cough, and a **spiky
  speech bubble** with grawlix **"#@%&!"** pops in (letters jiggle). Biscuit looks up at her,
  ears droop. Bubble gone by ~11.
* 11.2–12.1: Juno sighs, shoulders slump.
* **12.14 (bar 5 downbeat):** the traffic cone falls from the sky and lands **on Biscuit's
  head** (bonk-star burst, Biscuit dazed, cone stays on like a party hat).
* 12.74–13.5: Juno wipes her goggles → two clean circles around her eyes.
* **13.58 ("start again", to 15.54):** she crumples the old "TEST #1" blueprint and tosses it;
  **14.54 (bar 6)** she whips out a new rolled blueprint and unrolls it — a big drawing of
  S.S. BISCUIT labelled "TAKE 2!"; **15.14** determined fist pump / Biscuit barks.
* **16.24 → silence:** everything freezes; both slowly turn to look straight at the camera
  (deadpan hold). No motion except a blink.

### s03_take_two — 16.94 → 19.34 (bar 7) · transition: cut
* 16.94–17.45: silence. A **film clapperboard** ("SCENE 1 · TAKE 2", Juno-scrawled) rises in
  on a dark background, open.
* **17.54 (b1, guitar restarts): CLACK** — clapper snaps shut with burst lines + a tiny shake.
* 17.6–19.3: clapper drops away; the title **"STRINGS"** is drawn as a **constellation**: stars
  pop on guitar plucks (`pluck(t)`) and glowing strings connect them letter by letter; small
  subtitle "a Juno & Biscuit adventure". Deep indigo starry sky; silhouette of the garage and
  the house roofline along the bottom.

### s04_build — 19.34 → 28.94 (bars 8–11) · transition: flash (drums in!)
Workshop montage, **one shot per bar**, whip-pan between shots (handle inside the scene).
Warm garage interior: pegboard of tools, workbench, a hanging bulb swinging to the beat.
Characters now clean (no soot).
* **bar 8 (19.34):** Juno hammers a panel on the rocket frame — **hammer lands on every beat**
  (19.34, 19.94, 20.54, 21.14) with a star "tink" spark; Biscuit holds a nail box in his
  mouth, head-bobbing.
* **bar 9 (21.74):** welding — Juno goggles down, torch sparks burst **on every beat, bigger on
  snares** (2 & 4); flicker lighting. Biscuit wears tiny goggles.
* **bar 10 (24.14):** painting — Juno on a stepladder, a **red stripe/fin appears each beat**;
  Biscuit steps in the paint can, then **25.94 (b4)** stamps the paw-print decal on the hull.
* **bar 11 (26.54):** the garage door rolls up (26.54–27.14), the finished **S.S. BISCUIT** is
  rolled out into the golden backyard; **28.34 (b4)** Juno slaps a star sticker on it, a glint
  runs up the hull, Biscuit barks.

### s05_suit_up — 28.94 → 36.14 (bars 12–14) · transition: whip
Humming vocal. Golden/sunset backyard.
* **bar 12 (28.94):** quick-change gag — Juno spins in a cartoon whirl cloud and pops out in
  her **spacesuit on 29.54**; she plonks the fishbowl helmet on Biscuit **30.14**, then on
  herself **30.74** (glint on each).
* **bar 13 (31.34):** **hero walk** toward camera, low angle, slow-mo, lens flare, steps land on
  beats, grass swaying, the rocket towering on its pad behind them.
* **bar 14 (33.74):** Juno climbs the gantry ladder, one rung per beat, Biscuit tucked under
  her arm; at the top she turns and waves (35.54); **hatch slams shut ~35.9**.

### s06_countdown — 36.14 → 38.54 (bar 15) · transition: cut
Bass drops out — tension. **Cockpit close-up**: dashboard dials, lights blinking on beats,
Juno (helmet) gripping the joystick, Biscuit in the co-pilot seat puts on **sunglasses**.
* Countdown fills the screen: **"4" 36.14, "3" 36.74, "2" 37.34, "1" 37.94** — each with a
  zoom-punch and increasing shake; Juno slams the big red button on the "1"; everything rattles.

### s07_liftoff — 38.54 → 43.34 (bars 16–17) · transition: flash
* **38.54: LIFTOFF.** Backyard wide: engine ignites, enormous billowing smoke rolls across the
  yard, fence planks flap, a garden gnome falls over, leaves blow off the tree. The rocket rises
  (slow then accelerating), camera tilts up after it (`skyExtend`). Flame pumps with `kick(t)`.
* **bar 17 (40.94):** the rocket punches up through the clouds (clouds rush down past camera),
  a flock of birds scatters, the sky deepens. Shake on kicks.

### s08_ascent — 43.34 → 50.54 (bars 18–20) · transition: cut
* **bar 18 (43.34):** side view climbing; sky gradient shifts blue → indigo; an airliner
  passes with a startled passenger face at a window; Juno & Biscuit wave from the portholes;
  first stars appear.
* **bar 19 (45.74):** Earth's curve appears below with a thin blue atmosphere glow; into black
  space; stars twinkle on hats.
* **bar 20: STAGE SEPARATION on 48.14** — booster pops off (ring burst + sparkles) and tumbles
  away; the main engine re-ignites; rocket sails off into space.

### s09_zero_g — 50.54 → 55.34 (bars 21–22) · transition: cut
Bass out, floaty. Capsule interior (cutaway) with a porthole showing Earth.
* Juno's pigtails float up (`hairFloat`), Biscuit floats upside-down paddling.
* Floating kibble balls — Biscuit **chomps one per beat** from 51.14 on.
* Juno does one slow somersault across the two bars.
* 54.74: Juno looks out the porthole: a giant ringed planet looms.

### s10_gravity — 55.34 → 57.74 (bar 23) · transition: fade (0.6 s)
Drums drop out; **"go where the gravity takes me"** (`drawLyric(ctx, t, LYRICS.gravity, …)`
from `src/lyrics.js`, lower third). Wide, dreamy: tiny rocket (engines off) drifting toward a
HUGE banded ringed planet filling the right of frame; a dotted trajectory arc curves around it;
the rocket starts to fall along the arc, accelerating; slow zoom building tension to the drop.

### s11_slingshot — 57.74 → 60.14 (bar 24) · transition: flash (THE DROP)
* **57.74:** WHOOSH — the rocket whips round the planet: speed lines, radial streaks, camera
  rotating.
* **58.34:** cut-in: Juno & Biscuit faces squashed by g-force (cheeks/ears/tongue flapping).
* **58.94:** wide: the rocket slings out with a sparkling trail.
* Keep drawing `LYRICS.gravity` so the line finishes fading (it ends ~59.2).

### s12_stars — 60.14 → 69.74 (bars 25–28) · transition: fade (0.6 s)
Quiet gorgeous starfield (violet, soft nebula). Engines off. **"just me and the stars"**
(`LYRICS.stars1` 61.36, `LYRICS.stars2` 65.79).
* Juno and Biscuit sit on the rocket's nose (tethered), seen **from behind** (`view: 'back'`),
  legs dangling, looking out at the sky, bobbing gently to the beat.
* **bar 26 (62.54):** a **dog constellation** draws itself — one string per beat — Biscuit wags.
* **bar 27 (64.94):** Juno points; a **girl-with-pigtails constellation** draws itself.
* **bar 28 (67.34):** a string joins the two constellations (like holding hands); Juno and
  Biscuit lean together; a shooting star at 68.54.
* Stars twinkle on hi-hats throughout.

### s13_moon_bounce — 69.74 → 76.94 (bars 29–31) · transition: cut
* **bar 29 (69.74):** rocket lands on a small lavender moon (legs out, dust puff on 69.74);
  hatch opens; they bounce out.
* **bar 30 (72.14):** low-gravity bounces — big slow arcs **landing every 2 beats** (72.14,
  73.34, 74.54) with dust puffs; Biscuit flips; Juno plants a paw-print flag at 73.94.
* **bar 31 (74.54, bass out build):** Biscuit freezes, ears up, **"!"** pops; a **comet**
  streaks overhead (74.54→76.3); Biscuit quivers with excitement; 76.34 they zip back to the
  rocket with speed lines.

### s14_comet_chase — 76.94 → 88.94 (bars 32–36) · transition: flash (loudest section)
One shot per bar, hard cuts/whips, maximum energy.
* **bar 32 (76.94):** rocket blasts off the moon after the comet (glowing yellow head, sparkly
  tail), speed streaks.
* **bar 33 (79.34):** cockpit close-up: Juno's determined grin on the joystick; Biscuit's ears and
  tongue flapping, dashboard flashing on beats.
* **bar 34 (81.74):** asteroid field — the rocket **swerves on every beat** (81.74, 82.34,
  82.94, 83.54), asteroids whoosh past camera.
* **bar 35 (84.14):** loop-the-loop around a big asteroid leaving a star trail.
* **bar 36 (86.54):** Juno swings a big butterfly net from the hatch and **catches the comet on
  87.14** — it's a cute **baby star** with a face! Sparkle burst on 87.74.

### s15_nebula — 88.94 → 96.14 (bars 37–39) · transition: fade (1.0 s)
Bass out, floaty build. A pink/teal nebula.
* **bar 37:** in the capsule the baby star glows in Juno's cupped hands, pulsing on beats;
  Biscuit sniffs it; they look at each other — let it go.
* **bar 38 (91.34):** exterior: Juno opens her hands at the hatch; the baby star zooms off
  leaving a glowing string; the rocket follows.
* **bar 39 (93.74):** build — the rocket spirals after it faster and faster (rotation speeds
  up, stars streak), whiting out at 96.14.

### s16_star_strings — 96.14 → 105.74 (bars 40–43) · transition: flash (PEAK)
The baby star leads, the rocket follows, and its trail becomes a glowing **rainbow string**
connecting stars into giant constellation pictures — **a new connection snaps on every beat**
(sparkle), **one picture per bar**: bar 40 heart, bar 41 Biscuit's face, bar 42 Juno with
pigtails, bar 43 the S.S. Biscuit. Camera pulls back each downbeat to show the growing sky
gallery; at 105.1 the baby star takes its place in the sky and winks.

### s17_homeward — 105.74 → 112.94 (bars 44–46) · transition: fade (1.2 s)
Bass out, humming continues to 111.7.
* **bar 44:** Earth rises huge and blue; sunrise flares over its limb at 108.1.
* **bar 45 (108.14):** capsule: Juno yawns, Biscuit curls up asleep in her lap, "z" bubbles
  float up on beats; she flips a switch labelled "HOME".
* **bar 46 (110.54):** exterior: the rocket turns tail-first toward Earth.

### s18_reentry — 112.94 → 115.34 (bar 47) · transition: cut
Drums only. Fiery re-entry: the underside glows orange/red, a plasma trail, shake on kicks;
a quick insert of Juno holding tight and Biscuit's ears flapping; **114.74 (b4): parachutes
pop** (three red/cream striped canopies).

### s19_backyard_night — 115.34 → 124.94 (bars 48–51) · transition: fade (0.6 s)
Gentle guitar outro. Night backyard (`tod: 'night'`), lit house windows, fireflies.
* **bar 48:** the rocket descends softly under parachutes, swaying with the beat.
* **bar 49 (117.74):** touchdown puff next to the old test-rocket crater; hatch opens.
* **bars 50–51 (120.14–124.9):** Juno and Biscuit lie on a blanket on the grass looking up;
  above them the constellations they made (heart, Biscuit, Juno) twinkle; the little star
  winks. Biscuit snuggles in.
* **~124.2:** Biscuit's paw bumps the old remote — a little firework whistles up out of frame.

### s20_the_end — 124.94 → 128.00 (bar 52) · transition: cut
* **124.94 (final drum hit):** the firework bursts high in the sky into sparkly **"THE END"**
  letters with star bursts; silhouettes of Juno and Biscuit cheering on the grass below.
  Sparkles drift down; the engine fades everything to black by 128.
