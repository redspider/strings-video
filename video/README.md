# Strings — music video

A procedurally drawn cartoon music video: Juno and her dog Biscuit blow up a test rocket
(the song's false start), start again, build the S.S. Biscuit and fly to the stars.
Every frame is a pure function of song time, drawn with the Canvas 2D API.

- `STORYBOARD.md` — beat-by-beat plan (bar k starts at 0.135 + 2.4·k s, 100 BPM)
- `STYLE.md` — style bible and module contracts; `ASSETS_API.md` — character/prop APIs
- `src/scenes/` — the 20 scenes; `src/characters/`, `src/props/` — shared assets
- `src/audio_data.js` — beat grid, drum hits and stem envelopes (from `../analysis/`)

## Render

```bash
cd video
node render.mjs video --out ../Strings_music_video.mp4          # full 1080p30 with audio (~30 s on 12 cores)
node render.mjs video --from 55 --to 62 --scale 0.5 --out out/clip.mp4
node render.mjs sheet --from 0 --to 7.3 --count 12 --debug       # contact sheet with bar.beat overlay
```

Live preview with audio: serve the repo root (`python3 -m http.server 8123`) and open
`http://localhost:8123/video/preview.html` (space = play/pause, arrows = step frames).

ffmpeg comes from the `imageio-ffmpeg` package in `analysis/.venv` (override with `FFMPEG=`).
