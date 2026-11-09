# Changelog

## Unreleased

### Fixed

- **`sample()` worked on one machine only.** `sfx/synth.py` called ffmpeg at a hard-coded `C:\Users\...\ffmpeg.exe`. It now uses `FFMPEG` from the environment, else `ffmpeg` on PATH, like the rest of the kit, and says what is missing when it fails.
- **Review frames landed on the wrong moments.** `capture --stills beats`, `sheet.mjs --timeline` and `wave.mjs --timeline` read every number in `timeline.json` as a beat, settings included. The piranha's camera factors `push` (0.72) and `opt` (0.88) turned into bogus beats at 0.72 s and 0.88 s, and a demo's `film` into one more at its end. Demo beats are written in scene seconds but were read as film seconds, so on `tarantula-demo` the jump at 9.6 s was sampled at 9.9 s of a 10 s film, at the closing frames instead of the jump. All three tools now share `timeline.mjs`: beats are the `script` times, moved to film time for a short version.
- **`anchors_dump.mjs` crashed on the tarantula and the wasp.** It read a table `A` that only the piranha exposes. It now prints every named anchor in world space at a film time you choose (`[t]`), and still prints `A` where one exists.
- **`cam_track.mjs` stopped early on demos.** It walked scene time only up to the film's length, which left out the last 1.2 to 1.3 s of `piranha-demo` and `tarantula-demo`. It now walks the whole film.
- `sheet.mjs` without `--video` ran ffprobe on the current folder and crashed. It now says what to pass.
- `sheet.mjs` labels used a Windows-only font path. Other systems drew labels only when ffmpeg fell back to a font of its own. It now picks a monospace font per system (or `CUTAWAY_FONT`).
- A tiled review sheet could show tiles left over from an earlier, longer run with the same `--out`. Old frames and sheets are cleared first.
- `build.mjs` escaped `</script` in lower case only.
- `capture.mjs` ignored ffmpeg's exit code, and could wait forever on a pipe ffmpeg had already closed. It now checks for ffmpeg before rendering, and stops when an encode fails.
- `wave.mjs` drew its one-second grid with a rounded cell width that drifted up to 19 px by the end of a 21 s film. It now draws each second where it falls, and stops cleanly on a file with no audio.
- `run_sfx.py` accepts a `TL=` path relative to the current folder as well as to the cue sheet, and explains a missing or broken timeline in one line instead of a traceback.

### Added

- `film.mjs`: one command from an entry to a finished, scored 1080p film with its review sheets. It builds, captures in 4K, scores, stretches a demo's sound by `duration / film`, muxes, then makes the sheets and the loudness check. The cue sheet for each entry is found by the examples' convention.
- `check.mjs` (`npm run check`): checks every timeline against the contract, bundles every entry in memory, compiles every Python file and loads every cue sheet. Takes seconds and needs no GPU. `--sound` also scores every entry and checks −14 LUFS.
- `.github/workflows/check.yml`: runs the check with sound and builds the six pages on every push. The pages are uploaded as an artifact.
- `build.mjs` warns about a broken timeline, and lists the entries when a name is wrong.
- A missing `npm install` or ffmpeg now prints the command that fixes it instead of a stack trace.
- `npm run` scripts for `film`, `capture`, `sheet`, `wave` and `check`; `engines` set to Node 20+.

### Changed

- `cam_track.mjs`, `anchors_dump.mjs` and `probe_warm.mjs` find the page's global themselves (`SP`, `PIRANHA`, `WASP`), so the `<global>` argument is optional. They share `sims/green/open.mjs`.
- SKILL.md documents `film.mjs`, which cue sheet scores which entry, the timeline's settings versus its beats, and `python3`. README has a troubleshooting table.
- Comments and docstrings that pointed at files from other projects (`v8-live`, `sfx/cues/effort.py`, `roboangler-film`, `robospider-sim`, `robobee-sim2`) now point at this repo's files.
- Three unused imports removed (`director.js`, `bee.js`, `tour_10.js`).
