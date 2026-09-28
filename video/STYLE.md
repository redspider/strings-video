# Style bible & code contracts

The whole film is drawn procedurally with the Canvas 2D API (same code runs in Node via
`@napi-rs/canvas` and in the browser). Logical frame is **1920×1080**; the engine scales.

## Hard rules for all code

1. **Pure function of time.** `draw(ctx, t)` must produce the same image for the same `t`,
   regardless of which frames were drawn before (frames are rendered out of order in parallel
   processes, and the preview scrubs). No `Math.random()`, no `Date`, no module-level mutable
   state that carries between frames. Use `hash01(i, seed)`, `noise1(x, seed)`, `mulberry32(seed)`
   from `src/util.js`. Particles etc. must be computed analytically from `t`.
2. **Always `ctx.save()`/`ctx.restore()`** around any transform / alpha / clip changes.
3. **Performance:** stay under ~25 ms per 1080p frame for a scene (check with
   `node render.mjs bench --from A --to B`). Avoid `ctx.filter`, `shadowBlur` (slow); fake glows
   with `glow()` radial gradients. Avoid per-pixel work.
4. ES modules, relative imports with `.js` extensions. No new npm deps.
5. Draw with the shared palette `PAL` and ink colour `INK` from `src/draw.js`. Outline width is
   `LW = 6` at character scale 1 (just let `ctx.scale` scale it). Every solid shape gets the ink
   outline (use `ink(ctx, fill, lw)` after building a path, or `circle/ellipse/rrect/blobs`).

## Look

* Flat, bright, saturated cartoon (think *Bluey* / *Hilda* / Cartoon Saloon, simple and rounded).
* Every solid shape: flat base colour, ONE darker shade shape on the side away from the light
  (light comes from upper-left), a small white/pale highlight, and a thick rounded ink outline.
* Squash & stretch, overshoot (`ease.outBack`, `spring`, `wobble`) on everything that moves.
* Big readable silhouettes. Faces must read clearly even at half size.
* Things *land* on the beat: use `pulse(t)`, `kick(t)`, `hop(t)`, `barTime(k)` from
  `src/timing.js`. Idle motion (breathing, tail wag, bobbing) should also be tempo-locked
  (e.g. `sway(t, 2)`, `hop(t, 1)`), never at arbitrary frequencies.

## Characters

### Juno (the girl, ~8 years old)
* Proportions: big round head (≈ 38–40% of standing height), small body, short stubby limbs
  with mitten-ish round hands (4 fingers optional, simple), round shoes.
* Skin `#f2c49b` (shade `#d9a37a`), rosy cheeks `#ff9b8a`, a few freckles.
* Hair: bright ginger `#e8672a` (shade `#b8461c`, highlight `#ff9a5c`), curly, **two big puffy
  pigtail buns** on the sides of the head + a curly fringe. The buns bounce on the beat.
* Big eyes: white sclera, large dark pupils `#1d1a2f` with a white highlight dot; thick brows
  that carry expression.
* Outfit (ground scenes): **blue overalls** `#3f7fe8` (shade `#2c5fb8`) with a yellow star patch on
  the bib, a red/white horizontally-striped long-sleeve shirt `#e8453c`/`#fffaf0`, red sneakers
  with white toe caps. **Aviator goggles** (brown strap `#7a4a2a`, round amber lenses `#ffc76b`)
  pushed up on her forehead.
* Spacesuit (space scenes): cream/white suit `#f4efe6` (shade `#d6cfc2`) with orange cuffs,
  collar ring and boots `#ff8a3d`, a round red mission patch with a white star on the chest,
  small backpack. **Glass fishbowl helmet** — transparent pale-blue tint, ink outline, a big
  curved white glint on the upper-left. Her pigtail buns are visible inside the helmet.

### Biscuit (the dog)
* Small scruffy terrier-ish pup, about half Juno's height. Chunky round body, stubby legs,
  big head (≈ 45% of height), big floppy ears.
* Fur: cream-white `#fdf3e1` (shade `#e3d2b4`) with a **caramel patch** `#c9782f` over the
  LEFT eye and caramel ears, caramel tail tip. Black shiny nose, pink tongue `#ff7a8a`.
* **Red collar** with a **gold star tag**.
* Expressions: happy (tongue out), excited (ears up, big eyes), alert (ears perked, "!"),
  sad (ears down), dazed (spiral eyes), sleepy.
* In space: a smaller fishbowl helmet over the head (same glass style as Juno's), plus a tiny
  red harness/vest with a star.

### The rockets
* **Test rocket #1** (dies in the first 5 s): janky homemade — a dented grey **metal trash can**
  body, an orange **traffic-cone** nose, cardboard fins held on with silver **duct tape** crosses,
  "TEST #1" hand-written in marker. About 55% of Juno's height, on a launch pad of two
  wooden crates.
* **S.S. Biscuit** (the real one): classic retro rocket. Cream body `#fff1d6` with red
  `#e8453c` nose cone and three red fins, a red band, **two round portholes** with brass rims
  `#f6b93b` (Juno upper, Biscuit lower), rivets, one visibly **patched panel** (teal square with
  rivets), a **paw-print decal**, and "S.S. BISCUIT" painted along the side. A detachable
  lower **booster stage** (grey/steel with stripes) for launch. Exhaust flame: layered
  yellow core → orange → red outer, flickering with noise, pumping with the kick drum.

## Code contracts (shared modules)

```js
// src/characters/girl.js
export function drawGirl(ctx, x, y, s = 1, pose = {})     // (x,y) = ground point between feet
export function drawGirlHead(ctx, x, y, s = 1, pose = {}) // (x,y) = head centre (for close-ups / portholes)
export const GIRL_HEIGHT = 420                           // px tall at s = 1 (standing, no helmet)

// src/characters/dog.js
export function drawDog(ctx, x, y, s = 1, pose = {})      // (x,y) = ground point under the body centre
export function drawDogHead(ctx, x, y, s = 1, pose = {})  // (x,y) = head centre
export const DOG_HEIGHT = 210                            // px tall at s = 1 (standing, ears included)
```

Common `pose` fields (all optional; sensible defaults; unknown fields ignored):

| field | values | meaning |
|---|---|---|
| `t` | seconds | time, for automatic secondary motion (blinks, breathing, hair/ear bob, tail wag — tempo-locked) |
| `facing` | `1` / `-1` | 1 = faces screen-right (3/4 view), -1 = mirrored |
| `view` | `'front'` \| `'back'` | back = seen from behind (for looking at the sky / walking away) |
| `stance` | girl: `'stand' 'walk' 'run' 'sit' 'float' 'crouch' 'jump' 'lie'`; dog: `'stand' 'sit' 'walk' 'run' 'float' 'jump' 'lie' 'beg'` | body/leg layout. `'sit'` = sitting on an edge, legs dangling toward camera. `'lie'` = lying on back, drawn horizontally |
| `phase` | number | walk/run cycle phase (1.0 = full cycle, two steps) |
| `expr` | `'happy' 'grin' 'laugh' 'surprised' 'determined' 'dazed' 'annoyed' 'sad' 'sleepy' 'awe' 'wince' 'excited' 'alert'` | face |
| `mouth` | 0..1 | override mouth openness (talking / barking) |
| `blink` | 0..1 | 1 = eyes closed (auto blinks if omitted and `t` given) |
| `look` | `[dx, dy]` in -1..1 | pupil direction |
| `soot` | 0..1 | blackened by explosion (dark overlay on skin/fur/clothes, eyes stay white = classic gag) |
| `frizz` | 0..1 | hair / fur blown out into a frazzled poof |
| `helmet` | 0..1 | fishbowl helmet (fades/scales in) |
| `suit` | `'overalls'` \| `'space'` | girl outfit |
| `goggles` | `'forehead'` \| `'eyes'` \| `'none'` | girl goggles position |
| `armL`, `armR` | preset string `'down' 'up' 'wave' 'hips' 'point' 'forward' 'hold' 'cheer' 'reach'` **or** `{ a, b }` = shoulder angle & elbow bend (radians; a = 0 hanging down, +π/2 forward/horizontal, π straight up) | arm poses |
| `holdR`, `holdL` | `fn(ctx)` | item drawn in that hand's local frame (origin = hand centre, +x along forearm direction) — use items from `src/props/items.js` |
| `holdMouth` | `fn(ctx)` | dog: item held in mouth (origin = mouth) |
| `tilt` | radians | whole-body lean (pivots at the ground point) |
| `headTilt` | radians | head tilt |
| `squash` | e.g. 0.8..1.2 | vertical squash/stretch preserving volume (1 = none) |
| `hairFloat` | 0..1 | zero-g: hair/ears/tail float upward |
| `tail` | angle or `undefined` | dog tail angle override (default: tempo-locked wag) |
| `wag` | 0..1 | dog wag intensity (default 0.6) |
| `ears` | 0..1 | dog ears: 0 floppy down, 1 perked up |
| `tongue` | 0..1 | dog tongue out |
| `sunglasses` | bool | dog cool sunglasses gag |
| `blush` | 0..1 | extra cheek blush |

```js
// src/props/rockets.js
export function drawTestRocket(ctx, x, y, s = 1, o = {}) // (x,y) = bottom centre. o: { t, flame 0..1, wobble 0..1, charred 0..1 }
export function drawRocket(ctx, x, y, s = 1, o = {})     // (x,y) = bottom centre of the main stage; points up.
//   o: { t, flame 0..1, booster bool, boosterOffset px (separation), hatch 0..1, crew bool (faces in portholes),
//        crewPose {girl:{..}, dog:{..}}, glow 0..1 (re-entry heat), chute 0..1 (parachute deploy),
//        legs 0..1 (landing legs), build 'frame'|'panels'|'painted'|'done', paint 0..1, stickers bool, shake 0..1 }
export function drawFlame(ctx, x, y, len, width, t, o = {}) // flame pointing +y from (x,y)
export const ROCKET_HEIGHT = 720                         // px, main stage at s = 1

// src/props/items.js — each draws centred at origin, ~life size relative to Juno at s = 1
export function hammer(ctx, o) / wrench / remote(ctx, {pressed}) / paintbrush(ctx, {color}) / blueprint(ctx, {open 0..1, crossed 0..1, title})
export function flag(ctx, {t}) / net / bone / clapperboard(ctx, {clap 0..1, take, scene}) / nailBox / weldTorch(ctx, {t, on})
export function joystick / redButton(ctx, {pressed}) / starSticker / trafficCone / sunglasses

// src/props/cockpit.js — shared capsule interior (s06 countdown, s09 zero-g, s14 cockpit, s15, s17, s18)
export function drawCockpit(ctx, o) // full-frame background: curved hull walls, big round front window,
//   dashboard with dials/switches/blinking lights (lights blink on beats), seats.
//   o: { t, view: 'dash' (looking forward over the dashboard) | 'cabin' (side cutaway, porthole on the wall),
//        window: fn(ctx, cx, cy, r) draws what's seen through the window (clipped for you),
//        lights 0..1 (blink intensity), shake 0..1, redButton {pressed 0..1}, homeSwitch 0..1, tint (alarm red 0..1) }
//   Characters are drawn by the scene on top (seat positions exported as COCKPIT_SEATS).

// src/props/backyard.js
export function drawBackyard(ctx, o) // o: { t, tod: 'golden'|'day'|'dusk'|'night', crater bool, pad 'intact'|'wrecked'|'none', skyExtend px (sky above for tilt-ups), garage bool, camX }
//   world space: ground line at y = 860 over x ∈ [-400, 2320]; launch pad centred at x = 1240.

// src/props/space.js
export function spaceBg(ctx, o)      // o: { t, seed, hue 'violet'|'blue'|'teal'|'magenta', stars count, driftX, driftY, nebula 0..1 }
export function drawEarth(ctx, x, y, r, o)       // o: { t, rot }
export function drawMoon(ctx, x, y, r, o)
export function drawRingedPlanet(ctx, x, y, r, o) // big gas giant with ring (gravity/slingshot scenes)
export function drawAsteroid(ctx, x, y, r, o)     // o: { seed, rot }
export function drawComet(ctx, x, y, angle, len, o) // head at (x,y), tail pointing along angle+π
export function constellation(ctx, pts, progress, o) // THE MOTIF: glowing "strings" connecting stars; progress 0..1 draws the lines in order
export function shootingStar(ctx, x, y, angle, u, o)
export function nebula(ctx, o)
export function drawMoonSurface(ctx, o)          // lavender moon ground: horizon arc + craters + rocks (s13); ground y ≈ 860
export function drawBabyStar(ctx, x, y, r, o)    // the cute baby star character (s14–s16, s19): o { t, expr, blink, wink, glow }
```

## Sync cheat-sheet (see `src/timing.js`)

* `barTime(k, beat=0)` → absolute seconds of bar k (+ beat within bar). 100 BPM, bar = 2.4 s.
* `pulse(t)` = 1 on every beat decaying; `kick(t)`, `snare(t)`, `hat(t)` = decays from detected
  drum hits (drums only exist 19.3–115.4 s and a final hit at 124.9 s); `pluck(t)` = guitar notes.
* `hop(t, n)` = |sin| bounce landing on every n beats. `sway(t, n)` = smooth ±1 sway.
* `env('bass'|'drums'|'vocals'|'other'|'mix', t)` = 0..1 loudness.
* Scene cuts happen on downbeats. Big moments (explosion, liftoff, drop, stage separation)
  are exactly on downbeats listed in STORYBOARD.md.

## Tools

* `node render.mjs sheet --from A --to B --count 12 --cols 4 --debug --out sheets/x.png` → contact
  sheet with timestamps (look at it with the Read tool).
* `node render.mjs stills --times 1.2,3.4 --scale 0.5 --outdir out/stills` → individual PNGs.
* `node render.mjs bench --from A --to B` → ms/frame.
* `node render.mjs video --from A --to B --scale 0.5 --out out/clip.mp4` → clip with audio.
