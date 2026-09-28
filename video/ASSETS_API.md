# Shared asset APIs (as reported by the agents that built them)

### girl (/Users/richard/src/experiments/music_video/video/src/characters/girl.js)
EXPORTS (exactly these four): drawGirl, drawGirlHead, GIRL_HEIGHT, girlAnchors.

- drawGirl(ctx, x, y, s = 1, pose = {}): (x,y) is the ground point between the feet.
- drawGirlHead(ctx, x, y, s = 1, pose = {}): (x,y) is the head centre. It uses the same drawHeadLocal code path as drawGirl. By default it also draws a neck and shoulder bust under the head (so she doesn't look like a floating head in a porthole). Pass pose.bust = false for the head only. pose.bustDepth (default 170) sets how far below the head centre the bust is clipped. It supports the helmet and looks right at s up to 3+.
- GIRL_HEIGHT = 420: standing height at s=1 without helmet. Head centre is at y = -334, hair top at about -424, buns top at about -433.
- girlAnchors(x, y, s = 1, pose = {}): returns world points {head, handL, handR, hip} as [x,y]. Extras: neck, mouth (for the smoke-ring cough), top (hair top, for smoke wisps and FX), eyeL, eyeR, footL, footR (ankles), shoulderL, shoulderR, and helmet {x, y, r} (the bowl circle). It uses the same rig as the drawing and accounts for tilt, squash, facing, headTilt, walk/run lean and lift. Costs about 0.002 ms per call.

POSE FIELDS (all optional):
- t (seconds): drives the automatic secondary motion. Auto-blink fires on every 6th beat (beat index % 6 == 3) for about 0.13 s. Buns bob with hop(t,1): up between beats, landing and squashing on the beat. Breathing follows sway(t,4). It also drives the 'wave' forearm oscillation (one wave per beat), dangling-leg kicks when sitting (sway(t,2)), zero-g bun drift and curl sway, and smoke-wisp rise. With no t, she is static.
- facing: 1 = 3/4 view facing screen-right; -1 = mirrored; 0 = straight front. Values in between blend the turn: features shift toward the facing side, the far eye narrows, the far ear hides, and the near arm swings across during walk/run. Shading stays lit from the upper-left on screen even when mirrored.
- view: 'front' | 'back'. Back view: curly hair mass covers the head, buns and hair ties show, the nape is visible, the goggle strap (with buckle) crosses the back of the head, overall straps cross in an X, there is a back pocket, and shoes are seen from the heel. In the spacesuit the backpack sits on the back.
- stance: 'stand' | 'walk' | 'run' | 'sit' | 'float' | 'crouch' | 'jump' | 'lie'.
  - walk/run: 3/4 uses 2-bone IK with knees forward; front view foreshortens the lifted leg. There is hip bob, and run adds a flight phase and forward lean. Arms swing opposite to the legs; the far arm goes behind the torso in 3/4 when arms are not overridden.
  - sit: on an edge at the ground point. A foreshortened lap shows the knees toward camera, with shins and shoes dangling below the edge line. In back view the legs are hidden (they hang over the far side).
  - float: relaxed bent legs, arms out drifting, hairFloat defaults to 1.
  - crouch: squat with knees out, hands toward the knees.
  - jump: legs tucked, arms 'cheer'.
  - lie: relaxed straight legs, arms slightly out, no shadow. Rotate it yourself for the top-down blanket shot.
- phase: walk/run cycle position; 1.0 = full cycle (two steps). Feet contact at phase 0 and 0.5, so phase = beatAt(t)/2 lands a step on every beat.
- expr: 'happy' 'grin' 'laugh' 'surprised' 'determined' 'dazed' 'annoyed' 'sad' 'sleepy' 'awe' 'wince' 'excited' 'alert'. Unknown values fall back to 'happy'.
  - dazed = spinning spiral eyes and a wavy mouth.
  - wince = >< eyes and gritted teeth.
  - laugh = ^^ eyes.
  - awe and excited = sparkle highlights.
  - sad = glossy eyes with brows up.
- mouth (0..1): overrides mouth openness for talking or coughing. It turns 'o' mouths into a sized O and other mouths into an open smile.
- blink (0..1): 1 = closed. When set, it overrides the auto-blink.
- look ([dx, dy], each -1..1): pupil direction.
- soot (0..1): all skin, hair and clothes colours mix toward PAL.soot (at 0.86 strength, so some hue remains). Eye whites, pupils, teeth, tongue and mouth stay bright. Cheeks and freckles vanish, lighter smudge blotches appear, and two rising smoke wisps appear above about 0.5. Goggles are sooted at only 45% so the askew gag still reads.
- frizz (0..1): back hair becomes a big spiky poof and buns turn spiky and bigger. The fringe turns zig-zag, and above 0.5 only the fringe edge is inked so the poof keeps one silhouette.
- cleanGoggleRings (0..1): two clean-skin circles around the eyes on a sooty face. Eyelids use the clean colour too.
- helmet (0..1): glass fishbowl (pale tint, edge gradient, big upper-left glint, orange collar ring). It scales in with outBack from the collar, so it "plonks" down. Buns shrink slightly and move inward to fit. It is drawn before the arms, so hands appear in front of the glass.
- suit: 'overalls' | 'space'. Space = cream suit, orange belt, cuffs, collar ring and boots, red mission patch with white star, small chest control box, and a small backpack peeking behind the shoulders (front) or on the back (back view).
- goggles: 'forehead' | 'eyes' | 'askew' | 'none'. The default is 'forehead', or 'none' when suit is 'space'. 'eyes' has see-through amber lenses over the eyes, with brows still visible above. 'askew' is tilted and slipped with one cracked lens. The strap is clipped to the head silhouette so it wraps out of sight.
- armL / armR: preset strings 'down' | 'up' | 'wave' | 'hips' | 'point' | 'forward' | 'hold' | 'cheer' | 'reach', or an object {a, b, hand?}.
  - armR is the arm on the side she faces (screen-right at facing 1); armL is the other.
  - a = shoulder angle: 0 hanging down, π/2 straight out sideways, π up. Negative a swings across the front of the body.
  - b = elbow bend added to a (the forearm direction is a + b).
  - Each arm is mirror-symmetric, so {a: π/2} on both arms gives a T-pose.
  - hand: 'open' (mitten) | 'fist' | 'point' | 'spread'.
  - Raised arms stretch up to 16% so the hands clear the big head.
- holdR / holdL: fn(ctx, info), drawn in the hand's local frame. Origin = hand centre, +x along the forearm; info = {dir, side, angle}. The item is drawn under the fingers (a grasped look).
  - The frame mirrors with the character. To keep text readable when facing < 0, call ctx.scale(-1,1) and draw the item toward -x (demonstrated in the sheet).
- holdRFront / holdLFront (bool): draw the item over the hand instead, e.g. an object resting in an open palm.
- tilt (radians): whole-body lean, clockwise on screen, pivoting at the ground point.
- headTilt (radians): clockwise on screen, pivoting at the neck (in drawGirlHead it pivots at the head centre).
- squash: e.g. 0.8..1.2; sy = squash, sx = squash^-0.6, about the ground point.
- hairFloat (0..1): zero-g. Buns rise and stretch upward, drifting with sway; the fringe lifts; two loose curl strands float off each bun.
- blush (0..1): bigger, stronger cheek blush.
- EXTRA lift (px at s=1): raises her above the ground point. The ground shadow stays on the ground and shrinks, which suits jumps and moon bounces.
- EXTRA shadow (bool): overrides the soft ground shadow. The default is on for stand/walk/run/crouch/jump, off for sit/float/lie.
- Unknown fields are ignored.

PERFORMANCE: measured with a forced Skia flush (getImageData) after each draw.
- s=1: about 2.0 ms stand/walk, 2.1 spacesuit + helmet, 1.5 back view, 2.3 sit, 2.9 soot+frizz.
- s=0.35: about 1.2 ms.
- drawGirlHead at s=3 with helmet: about 4.2–4.6 ms (fill-rate bound; close-ups only).
- Without the flush, napi-canvas reports about 0.5 ms because it defers rasterisation.
- A level-of-detail switch (from ctx.getTransform() × s < 0.45) skips lashes, freckles, stitching, laces, knuckle lines and shade curls in wide shots.

VERIFIED:
- Deterministic pixels whether or not other poses were drawn before (10/10 poses).
- 0 real canvas state leaks (pixel-tested).
- No Math.random, Date, shadowBlur or ctx.filter.
- Auto-blink fires on its beat.

### dog (/Users/richard/src/experiments/music_video/video/src/characters/dog.js)
EXPORTS
- DOG_HEIGHT = 210: px tall at s=1, standing, ears and cowlick included. Perked ears reach about -215.
- drawDog(ctx, x, y, s = 1, pose = {}): (x, y) is the ground point under the body centre. Local frame faces screen-right.
- drawDogHead(ctx, x, y, s = 1, pose = {}): (x, y) is the head centre. Uses exactly the same head code as drawDog and works up to s = 3 and beyond. By default it also draws a small chest/neck stub with the collar (and the vest when suit = 'space') so the head sits on something in portholes and close-ups; pose.neck = false turns the stub off. pose.tilt + pose.headTilt rotate it and pose.squash applies.
- dogAnchors(x, y, s = 1, pose = {}): returns world positions { head: [x, y], mouth: [x, y], tail: [x, y], crown: [x, y] }. crown is the hat origin. It accounts for stance, facing, tilt, pivot, squash and headTilt.

POSE FIELDS (all optional; unknown fields ignored)
- t (seconds): drives all automatic motion, all tempo-locked through timing.js beatAt.
  - Tail wag: `wagRate` cycles per beat (default 2).
  - Auto blink: at most one per bar, on a hashed beat, sometimes a double blink.
  - Ear bob: 1 per beat.
  - Head nod dipping on each beat: stand and sit.
  - Breathing: 1 per 2 beats, 4 when lying.
  - Panting tongue bounce for happy/excited.
  - Default gait phase (see `phase`).
  - Dazed stars orbit once per 2 beats.
  - Zero-g ear drift.
  - Without t everything is static.
- facing: 1 or -1. 3/4 view; -1 mirrors. Lighting stays upper-left on screen when mirrored. The caramel patch stays on Biscuit's own LEFT eye, i.e. always the screen-right eye.
- view: 'front' | 'back'.
  - 'back' + stance 'sit' (default) is seen from behind sitting: haunches, tail swishing on the ground, collar, vest on the back with star and tether ring, helmet.
  - 'back' + 'stand' | 'walk' | 'run' | 'jump' is standing/walking away with the tail up.
  - Other stances fall back to back-sit.
  - In back view, look[0] makes the snout peek out on that side. look[1] < 0 (looking up) makes the nose poke up over the crown, for stargazing.
- stance:
  - 'stand'.
  - 'walk': a step per beat by default.
  - 'run': rotary gallop, 1 cycle per beat by default; ears and tail stream back.
  - 'float': body round, legs splayed paddling with pink pads showing, hairFloat defaults to 1, 1 paddle per beat.
  - 'jump': nose up, front paws tucked, hind legs extended.
  - 'lie': curled up asleep, chin on paws, caramel tail tip tucked over the nose. The expression defaults to sleepy.
  - 'beg': sitting up, front paws raised and dangling.
  - 'sit': sitting.
- phase: gait phase, 1.0 = full cycle.
  - Defaults: walk = beat/2, run = beat, float = beat/2 (paddle runs at 2x).
- expr:
  - neutral (default), happy (tongue out, panting, cheek squint), grin, laugh (^ ^), excited (big sparkly eyes, ears up, blush), awe, alert (ears perked straight up with terrier fold-over tips, eyes wide, small pupils), surprised (O mouth).
  - sad (ears drooped, worried brows, watery glint, frown), dazed (rotating spiral eyes, 3 stars orbiting the head that pass behind and in front, lolling tongue), sleepy (closed eyes), annoyed (half lids, side-eye), determined (angry brows, angled lids, firm mouth), wince (> < eyes, teeth).
  - gforce: ears, cheek fur and tongue stream backwards (-x) and flap, lips pulled back with teeth, squint. It is toned down inside a helmet so everything stays inside the glass.
  - pose.gforce (0..1) overrides the intensity.
- mouth: 0..1, bark/open amount. It overrides the expression; the open jaw adds a chin, tongue and fangs.
- tongue: 0..1, tongue hanging out.
- blink: 0..1 override (1 = closed); otherwise automatic when t is given.
- look: [dx, dy] in -1..1, pupil direction. The default is slightly toward facing.
- ears: 0..1 (floppy → perked; negative = droopy). It overrides the expression's ears.
- tail: angle in radians; overrides the tail angle.
- wag: 0..1.5 intensity, default 0.6.
- wagRate: cycles per beat, default 2.
- soot: 0..1. Fur, ears, collar, vest and brows mix toward PAL.soot. Eye whites, nose and tongue stay as they are.
- frizz: 0..1. Spikes all round the head, body, ears and haunches; bottle-brush tail.
- helmet: 0..1. Glass fishbowl (pale-blue tint, ink outline, big curved white glint upper-left) with an orange neck ring. It drops in from above with fade and overshoot; ≥0.9 means fully on, and the ears then slide along the inside of the glass instead of poking through.
- suit: 'none' | 'space'. Space = red vest/harness with a yellow trim stripe, white star emblem and steel tether D-ring on the back.
- goggles: 'none' | 'eyes' | 'forehead'. Tiny welding goggles: brass rims, dark green lenses, brown strap.
- sunglasses: bool. Black shades with glints.
- pawsUp: 0..1. Front paws go up over the ears: the near paw presses the near ear flat, the far paw peeks over the crown. Ears flatten. Meant for sit/beg/stand; ignored for lie.
- pawWave: 0..1. The near front paw is raised, pads showing, and waves once per beat.
- holdMouth: fn(ctx). Item drawn with its origin at the mouth, then a jowl is drawn over it. Drawn un-mirrored so text stays readable; the open mouth is suppressed.
- hat: fn(ctx). Drawn with its origin at the crown, rotating with the head. Un-mirrored.
- tilt: radians. Whole-body lean; the pivot is the ground point.
- pivot: 'ground' (default) | 'center' (body centre, handy for upside-down floats).
- headTilt: radians.
- squash: vertical scale sy with sx = 1/sy, about the ground point.
- hairFloat: 0..1. Zero-g: ears drift up and wave, the tail floats and waves.
- blush: 0..1. Pink cheeks; the expression supplies a default.
- exclaim: 0..1. A red "!" with burst lines pops above the head (outBack).
- turn: 0..1, default 1. 0 turns the face straight to camera, for the deadpan look-at-camera beat; 1 = 3/4.
- bob: 0..1, default 1. Scales the beat head-nod and ear bob.
- collar: bool, default true.
- neck: bool, drawDogHead only (see above).

### rockets (/Users/richard/src/experiments/music_video/video/src/props/rockets.js, /Users/richard/src/experiments/music_video/video/src/props/cockpit.js)
=== src/props/rockets.js ===
Exports exactly: drawTestRocket, drawRocket, drawFlame, drawBooster, ROCKET_HEIGHT = 720, BOOSTER_HEIGHT = 300.

drawTestRocket(ctx, x, y, s = 1, o = {})
- (x, y) = bottom centre. About 235 px tall at s = 1: a funnel nozzle, a dented trash-can body with hoops and side handles, a lid rim, and a traffic-cone nose with a white stripe.
- Cardboard fins with torn corrugated edges, held on with silver duct-tape X's (the cone is taped on too). "TEST #1" is written in marker (FONT.hand).
- o.t: seconds.
- o.flame 0..1: a sputtering, coughing flame. Its length jumps between levels about 8.5 times a second and it sometimes nearly dies. Grey puffs spawn every 0.13 s at the base, some behind the rocket and some in front.
- o.wobble 0..1: drunken rocking about the base (about ±0.2 rad). The cone also wobbles loosely on its own.
- o.charred 0..1: soot over every part and a crooked cone. Above about 0.2, smoke curls rise from the top.
- o.shake 0..1: jitter.

drawRocket(ctx, x, y, s = 1, o = {}) — the S.S. Biscuit
- (x, y) = bottom centre of the main stage (the fin tips); 720 px tall at s = 1. With legs out, (x, y) is where the foot pads touch the ground.
- Layout in local coordinates at s = 1:
  - Body runs from y -84 to -720; widest half-width is 141, around y -340.
  - Nose seam at -548; red band from -226 to -190.
  - Juno's porthole: centre (-22, -458), glass radius 44. Biscuit's porthole: centre (-22, -342), glass radius 34.
  - Hatch door: x 46..118, y -528..-380; the doorway centre is about (82, -454).
  - Nozzle bottom at y -14. Fin tips at x ±236.
- Options:
  - o.t: seconds.
  - o.flame 0..1: main engine flame, pumping with kick(t). It is suppressed while the booster is attached.
  - o.booster bool: adds the steel lower stage (checker roll ring, red stripes, 3 fins). While attached, its collar hides the main nozzle and o.flame drives the booster's flame instead. Its top sits at y - 84·s and the stack extends to y + 216·s.
  - o.boosterOffset px: separation distance. The booster is drawn this far below and detached; smoke puffs and sparkles fill the gap while the offset is under 260.
  - o.boosterRot: booster rotation, pivoting at the booster's centre.
  - o.boosterFlame 0..1 (extra): flame for a detached booster; default 0.
  - o.hatch 0..1: the side door swings open on its right-hand hinge, up to 146°, showing a dark doorway with warm light, a floor and blinking lights. When open you see the padded inside of the door with a red wheel.
  - o.crew bool: Juno's and Biscuit's faces in the portholes, drawn with drawGirlHead / drawDogHead, clipped to the glass, with helmet 1.
  - o.crewPose {girl: {...pose}, dog: {...pose}}: passed through to the head functions. Extra keys s, dx, dy override the framing. Defaults: girl s 0.5; dog s 0.5 with dx -7·facing (dx flips with facing).
  - o.glow 0..1: re-entry heat. The underside and fins glow orange to white-hot. A plasma flame envelope plus two side streamers trail toward the nose, with a white-hot halo, heat-shimmer lines and embers. It assumes the scene rotates the rocket tail-first.
  - o.chute 0..1: three red/cream striped parachutes on lines from the nose tip. 0 = packed (nothing shown). About 0.2 = streamers popping out with burst lines. Above 0.25 the canopies inflate with overshoot and sway on the beat. At 1 they sit about 440–500 px above the nose.
  - o.legs 0..1: three telescoping legs with foot pads come out of the fins (outBack ease). The whole stage lifts by 64·legs·s so the feet stay on y.
  - o.build 'frame' | 'panels' | 'painted' | 'done':
    - frame: rib and stringer skeleton; two little red seats are visible inside.
    - panels: bare riveted plates with 3 gaps showing the ribs.
    - painted: cream body with red parts and primer; no decals.
    - done: everything, including the name, paw print and teal patch.
  - o.paint 0..1 (default 1; applies to 'painted' and 'done'): the red parts are painted in 4 slots, each with a wavy wet edge and drips: 0 left fin, 1 band, 2 right fin + front fin, 3 nose. Part i's progress is clamp(paint·4 − i).
  - o.stickers bool: gold star stickers, one on the hull and a small one on the nose.
  - o.shake 0..1.
  - o.rot (extra): rotation in radians, pivoting at the stage centre (y − 360·s).
- Small details (rivets, bolts, lettering) are dropped below about 0.28 effective scale. Outlines never get thinner than about 1.3 px on screen.

drawFlame(ctx, x, y, len, width, t, o = {})
- A layered flame pointing +y from (x, y): red outer layer with the ink outline → orange → yellow → white core.
- Animation: noise flicker in length and width, travelling ripples down the edges, a swaying tip, two curling side tongues, two detached licks, and embers/sparkles.
- o.color 'normal' | 'blue'.
- o.flicker 0..1 (default 1).
- o.seed.
- o.cap: roundness of the flame root.
- o.sparks bool.
- o.glow 0..1: radial root glow.
- o.lw: outline width (default LW).

drawBooster(ctx, x, y, s = 1, o = {})
- (x, y) = top centre of the collar; BOOSTER_HEIGHT = 300 at s = 1.
- o.t, o.flame 0..1 (pumps with kick), o.rot (pivot at its centre), o.shake.

=== src/props/cockpit.js ===
Exports drawCockpit(ctx, o), drawCockpitFront(ctx, o) and COCKPIT_SEATS. Pass the same o to both layers.

Options:
- o.t: seconds.
- o.view 'dash' | 'cabin'.
- o.window fn(ctx, cx, cy, r): content seen through the window, already clipped to the glass. The glass glare, rim shading and brass frame are drawn over it. The default is a batched twinkling starfield (twinkles on hi-hats) with a small ringed planet.
- o.lights 0..1 (default 0.6): at 0 the lamps show a fixed pattern. Above 0 the pattern re-rolls every beat and flashes with pulse(t). This covers the dash lamps, the cabin wall panel and the cabin fairy lights.
- o.shake 0..1: jiggles both layers, needles and toggles, and the hanging star charm.
- o.redButton 0..1: the button cap squashes down and glows.
- o.homeSwitch 0..1: the lever flips left → right with overshoot, the label turns red and the lamp turns green.
- o.tint 0..1: a flashing red alarm wash over the whole frame, plus ceiling beacons with rotating beams.
- o.stick [dx, dy] in -1..1 (extra): joystick tilt.
- o.joystick 'back' | 'front' | 'none' (extra, default 'back'): 'back' draws the stick in the back layer so a hand drawn by the scene sits on the knob.
- o.photo bool (extra, default true): the taped polaroid in the cabin.

'dash' view:
- Back layer: a curved capsule wall with rib rings, rivets, stringers and copper pipes with a valve, a vent, a star chart, a big round window with a brass frame (centre (960, 350), glass radius 250), a swinging star charm, red tufted seat backs (a star emblem on Juno's, a bone on Biscuit's), and the joystick, big red button and HOME switch sticking up above the console.
- Front layer: a wraparound console. The lip is at y 772 in the middle. It has dials (FUEL, SPEED, WAG-O-METER, SNACKS) with wobbling needles, 2 rows of lamps, a radar that sweeps once per bar, toggles, a bone button and plates.

'cabin' view:
- Back layer: a side cutaway of the capsule. Curved ceiling and floor, ribs, a handrail with yellow handholds, copper pipes with fairy lights, SNACKS/TOYS lockers, a taped polaroid of Juno & Biscuit (real head drawings), a brass porthole (centre (1170, 400), radius 150), a wall panel with a heartbeat screen, a caged lamp throwing a warm light pool, a padded bench with pillow and starry blanket, and an alarm beacon.
- Front layer: near-camera ribs at the frame edges, a hanging cable, and the alarm wash.

COCKPIT_SEATS:
- dash.girl = {x: 730, y: 840, s: 1.2, head: {x: 734, y: 560}, arms}. Use drawGirl with stance 'sit', facing 1, helmet. The arms field holds verified arm poses that put her hand on each control:
  - joystick: {armL: {a: 1.8, b: -1.05}}
  - home: {armR: {a: 2.5, b: -2.25}} (hand on the lever while it is off)
  - homeOn: {armR: {a: 1.95, b: -1.0}} (after flipping it on)
  - redButton: {armR: {a: 2.0, b: 0}, tilt: 0.4} (she leans over and slams it)
- dash.dog = {x: 1275, y: 790, s: 1.25, head: {x: 1242, y: 612}}. Use stance 'sit', facing -1.
- dash.window {x, y, r}; dash.joystick {x: 600, y: 712} (grip point); dash.redButton {x: 958, y: 708}; dash.homeSwitch {x: 848, y: 718}; dash.consoleY 772.
- cabin.girl = {x: 860, y: 735, s: 0.95, head: {x: 863, y: 514}} (sitting on the bench).
- cabin.dog = {x: 1085, y: 722, s: 0.95, head: {x: 1060, y: 587}} (stance 'sit' or 'lie' on the bench).
- cabin.lap {x: 870, y: 712}; cabin.window {x, y, r}; cabin.benchY 720; cabin.float {x: 960, y: 560}.

Measured cost per call at 1080p. Timings were taken while other agents were rendering at the same time (load average about 6), so they are noisy.
- drawRocket 'done': about 1.6 ms at s 0.5 and 2.4–2.6 ms at s 1.3.
- drawRocket with crew: about 5 ms, because the two character heads cost about 2.4 ms together.
- drawRocket with glow 1 (s 0.8): about 3.7 ms. Frame / panels: about 2.2 ms. s 0.15: about 0.45 ms.
- drawTestRocket with flame + wobble: about 2.5 ms.
- drawFlame (400 px long): about 0.65 ms.
- Cockpit 'dash': back about 7.9 ms + front about 2.9 ms. Cockpit 'cabin': about 8.3 ms.

### backyard (/Users/richard/src/experiments/music_video/video/src/props/backyard.js)
EXPORTS
1) drawBackyard(ctx, o = {}): draws in WORLD coordinates (wrap it in camera()). The ground line is y = 860 (characters stand here). It covers x in [-460, 2380] and y from -(skyExtend+700) down to about 2100. Layers, back to front: sky gradient, stars, altitude clouds; sun or moon, low clouds; far hills; near hills with small trees; neighbours' rooftops and trees; fence with rails and birds; lawn (gradient and patches); long shadows; back tufts and daisies; stepping stones; garage; flower bed A; doghouse with bowl and bone; flower bed B; gnome; house; tree with tire swing; crater; pad; crater smoke; front tufts and daisies; golden/dusk light wash; blown leaves; embers; fireflies.
   Options for o:
   - t (s): drives all tempo-locked animation. Tufts and flowers sway via sway(t,2). The tree and tire swing sway via sway(t,4). Birds hop every 2 beats and bob on pulse. The garage bulb swings via sway(t,4). Sun rays rotate with the beat and pulse. Stars twinkle on hats (starfield). Fireflies flash on beats, each assigned to one beat in four. Smoke billows have a 4-beat period.
   - tod: 'golden' | 'day' | 'dusk' | 'night'. Default 'golden'; any unknown value also becomes 'golden'.
     - golden: pink/orange sky, low sun at (650,470) with rotating rays, a warm screen-blended haze, and long purple shadows radiating from the sun.
     - day: blue sky, high sun, white clouds, short shadows.
     - dusk: purple/orange sky, a big half-set sun, faint stars, lit windows.
     - night: navy sky with twinkling stars, crescent moon at (1470,172), cool moonlight tint, lit house, attic and door windows with light spilling on the lawn, porch light, garage bulb on, fireflies.
   - pad: 'intact' | 'wrecked' | 'none'. Default 'intact': two crates ('FRAGILE' and 'UP' with arrows) side by side, x 1116–1364, top at y 756. 'wrecked': left crate tipped -0.3 rad, scorched, jagged top, propped on a plank; right crate splintered and tilted; loose charred planks, one stuck in the ground; splinters. With embers > 0 the crate edges smoulder.
   - crater (bool): scorched starburst on the lawn, lumpy dirt rim, dark hole with flickering coals and clods, at (1240, 868).
   - craterSmoke 0..1 (default 1 when crater is on): three columns of lobed smoke billows. Use 0 for the old crater at night (s19).
   - embers 0..1: rising, flickering sparks from the crater plus brighter coals and a glow.
   - skyExtend px (0..6000): the sky continues upward and deepens with altitude toward the tod's high colour, then its space indigo by about 4600 px. Puffy clouds (tod-coloured) are placed every 640 px up to 2900 px of altitude. Faint stars appear above 1700 px of altitude for non-night tods.
   - camX, camY: camera centre in world coordinates. Used for parallax: offset = (cam - (960,540)) × k, with k = 0.85 for sun/moon/low clouds, 0.78 far hills, 0.7 near hills, 0.6 rooftops/trees. Shadows and the light wash follow the shifted sun.
   - garage (bool, default true).
   - garageDoor 0..1: roll-up door open amount; the panels slide up under the header. Inside: dark interior, pegboard with tool silhouettes, workbench, and a hanging bulb with glow and a floor pool of light.
   - bulb 0..1: garage bulb. Default is on when the door is open or at night. At dusk/night it also lights the side window and the door windows.
   - fenceFlap 0..1: planks rattle and lean away from x = 1240, stronger nearby. About 10% are "loose" planks that swing wildly from their top nail. Planks jump vertically and the rails jitter.
   - wind 0..1: tree trunk and crown bend (up to about 90 px) with gusts and per-lobe flutter; up to 64 leaves blow off and swirl upward; tufts and flowers lean; the tire swing swings out; the rocket weather vane on the garage spins; smoke and embers drift.
   - windDir: -1 | 1. Default -1, blowing left, away from the pad.
   - gnomeFall 0..1: gnome tips over with an outBounce ease (animate 0→1).
   - gnomeDir: 1 falls right (default), -1 falls left.
   - silhouette 0..1: every ground-level colour and outline mixes toward near-black. Hills and rooftops mix toward lighter indigo so the depth layers still separate. Glows fade out. The house, attic and neighbour windows stay lit at night for the title card; garage door windows switch off.
   - lights 0..1: override the house window lights (default by tod: day 0, golden 0.15, dusk 0.85, night 1).
   - birds (bool, default true): three bluebirds on the fence top. They are hidden at night or when wind or fenceFlap > 0.15.
   - fireflies 0..1: default 1 at night, else 0.
   - sky (bool, default true): sky gradient, stars, sun/moon, clouds.
   - far (bool, default true): distant hills plus neighbours' rooftops and trees. Use sky:false with far:true when the scene paints its own starry sky.
2) drawGarageDoor(ctx, o): draws only the roll-up door panel in world coordinates, for layering a rocket inside the garage. Pass the same o as drawBackyard (garageDoor, tod, silhouette, bulb). Recipe: drawBackyard with the door open → draw the rocket clipped to BACKYARD.garageDoor → drawGarageDoor on top.
3) drawLawnTopDown(ctx, o): full frame in screen coordinates (1920×1080, drawn with a 240 px margin for shake).
   - Contents: mottled grass; fanned blade tufts that sway on the beat; clover; daisies and buttercups; pebbles; a red/white gingham picnic blanket (hem stripe, soft wrinkles, folded top-right corner, drop shadow, grass poking over its edge); moonlight wash and vignette at night; fireflies flashing on beats.
   - o: t; tod (default 'night'); blanket {x, y, w, h, rot} (default {960, 560, 1000, 640, -0.05}); fireflies 0..1 (default 1 at night).
   - At night the blanket only takes about 40–45% of the moonlight tint, so it still reads red and white.
4) BACKYARD constants (world coordinates):
   - groundY 860; x0 -400; x1 2320
   - padX 1240; padTop 756 (put the test rocket's bottom here); padW 248
   - craterX 1240; craterY 868
   - garageX 1820; garageBase 800; garageDoor {x0 1610, x1 1900, top 552, bottom 800}
   - houseX -110; houseRight 250; houseDoorX -120; houseWindowX 110
   - treeX 250; swingX 456
   - doghouseX 860; doghouseBase 818
   - gnomeX 1470
   - fenceBase 772; fenceTop 572; horizonY 560
   - Other layout points: flower beds at x 560–744 (behind Juno and Biscuit at about 600–720) and x 1404–1540 (the gnome's bed).

### space (/Users/richard/src/experiments/music_video/video/src/props/space.js, /Users/richard/src/experiments/music_video/video/src/props/items.js)
=== src/props/space.js ===
Every function is a pure function of its arguments. Anything that animates takes o.t (seconds), and all idle motion is tempo-locked through beatAt/pulse/hop/sway/hat. The outline width for bodies scales with r (about 2..7 px). Every body also accepts o.lw to override it.

spaceBg(ctx, o): full-frame deep-space background, drawn at 0..W x 0..H in the current transform, so call it before the camera.
  o: { t, seed=1, hue 'violet'|'blue'|'teal'|'magenta'|'pink' (default 'violet'), stars=350 (split across 3 parallax layers: 58% far / 30% mid / 12% near), driftX, driftY (parallax scroll in px; layer rates .15 / .4 / 1, and everything wraps), nebula 0..1 (a nebula wash drifting at rate .12), band 0..1 (default 1, a soft diagonal milky-way band with clustered stars) }.
  Stars twinkle with a tempo-locked shimmer. About 30% of them brighten on hat(t), and near-layer stars include 4-point sparkles.

SPACE_HUES: palette table per hue: { top, mid, bot, glow, neb:[5 colours] }.

nebula(ctx, o): soft, layered, painterly clouds (soft wash + flat low-alpha noisy shapes + brush wisps + bright cores + a soft dust lane + embedded twinkling stars). About 1500x800 px at scale 1, centred on (x, y). Drifts slowly with a 32-beat period.
  o: { t, hue (as above), x=W/2, y=H/2, scale=1, alpha=1, seed=3, colors:[...] (overrides the hue palette) }.

drawEarth(ctx, x, y, r, o): blue ocean with a lighter shallow patch; continent blobs projected onto a sphere, which rotate with rot, foreshorten at the limb and hide on the far side. Green land with a dark-green rim plus sand and forest patches. Projected polar caps, puffy white clouds with a soft underside and 3 cyclone swirls, atmosphere halo ring, inner rim glow, night-side crescent, highlight and ink outline.
  o: { t (clouds drift slowly), rot (spin, radians), glow 0..1 (halo, default 1), tilt (2D axial tilt, default -0.3), pitch (view latitude, default 0.2; use about -0.9 for a huge Earth whose top curve is in frame, e.g. s08, so the curve shows land and sea instead of the ice cap), clouds 0..1, night 0..1, lw }.

drawMoon(ctx, x, y, r, o): small lavender moon with soft maria, 7 foreshortened craters (dark upper-left inner wall, lit rim), crescent shade, highlight and outline.
  o: { rot (spins the crater pattern), seed=7, glow 0..1 (default .6), lw }.

drawMoonSurface(ctx, o): the lavender moon's ground for s13. The crest is an arc of a big circle, and it sits at y=860 at screen centre. Includes a horizon haze glow, a rim light and an ink outline along the crest, distant dune patches, speckle texture, perspective craters (rim mound + bowl, flatter and smaller toward the horizon, following the curve), rounded boulders with contact shadows, pebbles, and floating dust motes. Draw spaceBg first.
  o: { t, curve 0..1 (0 is nearly flat, 1 is a tiny moon; default .5, which drops about 160 px at the frame edges), seed=11, scroll (px; pans the features with depth parallax, for camera moves or walking), dust 0..1 }.
moonSurfaceY(x, {curve}): screen y of the crest at screen x. Use it to put feet, the rocket, the flag or dust puffs on the ground.
moonSurfaceAngle(x, {curve}): slope angle of the crest, for rotating things that stand on it.

drawRingedPlanet(ctx, x, y, r, o): banded gas giant with 12 latitude bands (cream, pink, peach, violet, orange). The bands are projected so they curve like the ring. It has wavy boundaries that drift with rot at different speeds per band, pinstripes, eddy ovals and curly wisps, a big red storm spot at latitude .14 that rotates with rot, a crescent terminator and a highlight. The ring is split into 5 opaque bands with a Cassini gap and a thin outer gap, plus striations. Its back half is drawn before the planet and its front half after. The ring shadow falls on the planet just below the front ring, and the planet's shadow falls on the back ring. Soft pink glow and ink outlines.
  o: { rot (band drift/rotation), tilt (whole system, default -0.32), open (ring opening angle, default .3), glow 0..1, lw }.
  The ring spans ±1.98r. Tuned to look good at r=700 filling the right of frame.

drawAsteroid(ctx, x, y, r, o): lumpy potato rock (smoothPath with hashed radii) with a lower-right shade, 3-5 craters, a highlight and an ink outline.
  o: { seed=1, rot (rotates shape and craters; shading stays lit from the upper-left), crack 0..1 (jagged crack grows from the middle, branches appear, and a faint warm glow shows near 1), split 0..1 (the two halves drift apart and rotate along the crack, showing an orange inner face), color (default '#a595c4'; try '#b08d73' for brown), lw }.

drawComet(ctx, x, y, angle, len, o): head at (x, y), moving along angle. The tail points along angle+π and is len px long. The tail is 3 soft tapered ribbons that wave backward on the beat, plus flowing glow puffs and twinkling sparkles. The head is a white-to-yellow ball with a halo and rotating 4-point sparkle rays that pulse on the beat.
  o: { t, size (head radius, default 34), seed=5, alpha, tailColors [near, far] (default ['#ffe27a', '#8fd3ff']), curve (px sideways bend at the tail end), star 0..1 (fades the baby star's face into the head, for the 'it's a baby star!' reveal), starExpr (default 'excited') }.

drawBabyStar(ctx, x, y, r, o): chubby rounded 5-point star (arcTo corners). Yellow '#ffd23f' with a screen-space orange shade on the lower-right, a warm inner light, glossy highlights and an ink outline. Big eyes with white sclera, INK pupils, one large and one small white highlight, and eyelids that come down from the top. Rosy cheeks, tiny smile. Warm halo, a few thin rotating light rays, and 4 orbiting sparkles, one of which pops on each beat.
  With t: bobs on hop(t), squashes on each beat (pulse), sways every 4 beats, and blinks automatically every 8 beats.
  o: { t, expr 'happy'|'excited' (star-highlight eyes, open mouth)|'surprised' (raised brows, O mouth, small pupils)|'scared' (worried brows, wavy mouth, sweat drop, tremble)|'sleepy' (half lids, small o mouth, floating z's, dimmer glow), blink 0..1 (overrides the auto blink), wink 0..1 (right eye closes to ^, grin, sparkle 'ting'), glow 0..1 (default 1), rot, look [dx, dy] in -1..1 (default [0, .15]), bob (default true when t is given), sparkles (default true), rays 0..1 (default .6), squash (e.g. .8..1.2, preserves volume), lw }.
  The halo reaches 3.1r and the sparkles orbit at about 1.5r.

constellation(ctx, pts, progress, o): THE MOTIF. pts is [[x,y], ...]. The strings draw in order, with equal time per segment: progress 0..1 maps to S segments, and each segment eases out (outCubic), so a scene can map one segment per beat and get a 'snap'. Each string is a wide low-alpha glow, a mid glow and a bright core. While a segment is drawing, a big rotating sparkle plus a glitter trail sits at its tip. Stars start as small dim twinkles, become big sparkles with a glow once connected, and pop to about 1.85x when the tip arrives, settling within 0.4 segment. Stars that belong to no segment (eyes, for example) light up just before the picture completes. Finished strings twang: a decaying vibration when each one completes, plus a small beat-synced wobble when t is given. Beads of light travel along finished strings, and stars twinkle on hat(t).
  o: { t, color '#bfe3ff', rainbow bool (hue shifts along the string and animates slowly), hue (rainbow start hue, default 200), lw=3, glow 0..1, starSize=10, alpha, segments [[i,j], ...] (default: consecutive), closed bool (adds last→first), vibrate 0..1 (default 1), dust 0..1 (the travelling beads), linear bool (no per-segment easing) }.
CONSTELLATIONS: ready-made pictures in a unit box (x right, y down, about -1..1), each { pts, segments }: heart (12 segments, closed), dog (standing dog facing right with tail up and a lone-star eye, 13 segments), dogFace (Biscuit's face with floppy ears, nose and mouth; the eyes are lone stars; 15 segments), girl (Juno with a big head, 2 pigtail buns, dress, arms up and legs; 26 segments), rocket (13 segments).
placeConstellation(shapeNameOrObj, cx, cy, size, rot=0): returns { pts, segments } in screen space. Call it as constellation(ctx, c.pts, p, { segments: c.segments, ... }).

shootingStar(ctx, x, y, angle, u, o): (x, y) is the START point. Over lifetime u 0..1 the head travels o.dist along angle (outQuad), the streak grows then shrinks, and it fades in and out. It draws nothing outside 0<u<1. Bright sparkle head with a glow, tapered gradient streak, and falling crumbs.
  o: { dist=700, len=320 (max streak length), size=9, color '#fff', tint '#bfe3ff', alpha }.

=== src/props/items.js ===
Everything is drawn at the origin at life size for Juno at s=1 (420 px tall), with house-style fills, one shade, a highlight and LW ink outlines. Handle items put their GRIP at the origin, with the handle along the y axis and the business end at -y: in the hand frame (+x along the forearm) the fist grips across it. Rotate if you need something else.

hammer(ctx): about 95x150 px. Red rubber grip at the origin, head centred near y=-92, striking face toward +x, claw toward -x.
wrench(ctx): about 52x160 px. Red grip at the origin (with a hanging hole), open jaw at y≈-94.
remote(ctx, {pressed 0..1}): homemade yellow box, 70x86, held around the origin, with a hazard stripe, silver tape corner, LED (green; red with a glow when pressed>.5), and a big red button whose cap height shrinks when pressed, with click lines above 0.6. Antenna ball at about (31,-117).
paintbrush(ctx, {color = PAL.red (paint colour; the handle end is dipped too), drip 0..1}): flat decorator's brush. Grip at the origin, ferrule at y -52..-20, bristles to y≈-104. drip adds paint runs down the ferrule, and above 0.6 a drop falls toward +y.
blueprint(ctx, {open 0..1, crossed 0..1, crumple 0..1, title, drawing 'test'|'rocket', t}): origin is the centre of the TOP edge, where two hands hold it at x=±170. The sheet is BLUEPRINT_W=340 by BLUEPRINT_H=250 and hangs down to y=250.
  open=0: a rolled scroll with a red ribbon. As open rises, the sheet unrolls downward and a shrinking bottom roll with spiral end-caps travels down with it.
  The sheet is blueprint blue with a grid, a border, a hand-written white title (auto-fit), and a white-line technical drawing. 'test' is the trash-can rocket with a cone nose, cardboard fins, tape crosses, notes and 'what could go wrong?'. 'rocket' is S.S. Biscuit with portholes labelled JUNO and BISCUIT, fins, nozzle, paw decal, dimension line and doodles. The default drawing is 'rocket'. The default title is 'TEST #1' for the test drawing and 'S.S. BISCUIT' otherwise.
  crossed: a red marker X with a thin ink edge; stroke 1 draws over 0..0.5, stroke 2 over 0.5..1.
  crumple: the sheet collapses into a faceted paper ball about 92 px across, centred on the ORIGIN at 1, with the shrunken content still visible.
flag(ctx, {t, color = PAL.red, wave 0..1}): grip at the origin. Steel pole from a spike at y=+124 (export FLAG_POLE_BOTTOM=124) up to a gold ball at y=-236. A 150x96 cloth flies toward +x, with a cream paw print that follows the cloth's shear. The wave is a travelling sine, one cycle per 2 beats, with light/dark shading on crests and troughs.
net(ctx, {t, swing ±1, glow 0..1, full 0..1, inside fn(ctx)}): big butterfly net. Grip at the origin (red wrap), wooden pole, and a yellow 3/4-view hoop (ellipse) centred at NET.hoop=[0,-300] with rx 30, ry 62. The translucent mesh bag trails toward +x (swing -1 mirrors it) and sways on the beat. glow adds a warm light inside the bag. inside(ctx) is drawn in the bag behind the mesh, with its origin at NET.bag=[78,-290]; use it to put the baby star inside.
  export NET = { hoop, rx, ry, bag }.
bone(ctx): about 108x50 cream dog bone, centred.
clapperboard(ctx, {clap 0..1 (0 = arm raised about 29°, 1 = shut), scene='1', take='2', title='STRINGS'}): origin is the centre of the slate body, about 300x225 including the sticks. Dark slate with chalk grid and chalk handwriting ('PROD.', title, SCENE and TAKE boxes with big numbers, 'DIR. JUNO', 'CAM. BISCUIT', a paw doodle). The striped fixed stick and the arm have opposite stripe slants, and the hinge is at the top-left.
nailBox(ctx): little wooden caddy full of nails. The origin is the middle of the dowel handle, where the dog bites. The box hangs below, about 96x66, labelled 'NAILS'.
weldTorch(ctx, {t, on 0..1, sparks 0..1 (default = on)}): brass grip at the origin, red and blue hoses trailing down-left, steel neck bending forward to a copper nozzle. When on: a blue/white oxy flame with glow and flicker, and a spark spray that pulses on the beat and reseeds 24 times a second.
  exports TORCH_TIP=[64,-100] (flame origin) and TORCH_DIR=-0.52 (flame direction).
joystick(ctx, {tilt radians, ±0.8, + = right}): origin is the pivot. Base plate below at y 6..32, a rubber boot that leans with the stick, and a black grip with a red top button and trigger.
  joystickGrip(tilt) returns the hand position [x,y].
redButton(ctx, {pressed 0..1, label='LAUNCH' ('' for none)}): 3/4 top view. Origin is the centre of the housing top. Dark cylinder housing with a hazard-striped ring and a red cap whose height shrinks when pressed, with impact lines above 0.6. About 120x80.
starSticker(ctx, {rot, peel 0..1}): gold star with a white die-cut border, shine stripes and a sparkle, about 88 px, centred. peel lifts the lower-right point.
trafficCone(ctx, {charred 0..1, t, smoke 0..1}): origin is the CENTRE OF THE BASE, with the cone pointing to -y, so it can sit on Biscuit's head. About 80x92, orange with white bands. charred adds a soot gradient from the tip, soot streaks, greyed bands, a bent tip and a crease line. smoke adds a tempo-locked curl of smoke from the tip.
sunglasses(ctx): about 124 px wide (Biscuit-sized) wayfarers with a thick frame, dark violet gradient lenses with white glints, and temple stubs. Origin is the bridge centre.
ITEMS: { hammer, wrench, remote, paintbrush, blueprint, flag, net, bone, clapperboard, nailBox, weldTorch, joystick, redButton, starSticker, trafficCone, sunglasses }.
Other exports: BLUEPRINT_W, BLUEPRINT_H, FLAG_POLE_BOTTOM, NET, TORCH_TIP, TORCH_DIR, joystickGrip.

### ART DIRECTOR — scale contract & scene notes (follow these)
BLOCKER 2 — NO SHARED SCALE CONTRACT
- The porthole crew is drawn at 0.5 × rocket s, so the S.S. Biscuit is 3.4 × Juno's height at "crew-true" scale.
- Against that: the hatch doorway (72×148 units) fits only a Juno at 0.35 × rocket s, and the garage door (290×248) fits the rocket only at s 0.34, which is about 1.2 × Juno when she's at 0.5.
- The test rocket at character scale reads tiny on its crate pad.
- Proposed contract (validated in lineup_g):
  - Backyard wides: characters s = 0.42. Juno is 176 px, below the 200 px fence top, which reads as a kid.
  - Test Rocket #1 at 1.4 × character s, or the same s after the rockets fix below.
  - S.S. Biscuit at 2 × character s = 0.84 (605 px, plus 181 for the booster). Frame it with camera zoom 0.75–0.85.
  - Hatch and garage must fit those sizes (rockets fix 1, backyard fix 2).
  - The cockpit keeps its own COCKPIT_SEATS scales. The moon shot at 0.84 / 0.42 (lineup_e2) reads well.


SCENE NOTES (for scene authors, not module fixes)
- Juno's maximum hand span is 242–248 units ('forward' preset / T-pose), so hold blueprint() at scale about 0.71 with arms 'forward'. Hand-held items (remote, hammer) read well at 0.5–0.6.
- Characters need their own ground and long shadows (see backyard fix 5).
- The top-down lie shot (f3) reads well. Add a soft contact shadow under both characters.
- Biscuit 'lie' at COCKPIT_SEATS.cabin.lap at the girl's s reads as a lap-sleep (d3).
NOTE (rockets fix): Test Rocket #1 is now drawn 1.35x internally (TEST_ROCKET_HEIGHT ≈ 323 at s=1) — draw it at the SAME s as the characters. Use todTint(tod) from backyard.js as the `light` pose/option for girl/dog/rockets in night/dusk scenes so they match the yard lighting.
