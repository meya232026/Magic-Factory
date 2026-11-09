# cutaway

A Claude Code skill that turns one picture into a 3D object that takes itself apart.

Give Claude an image of a robotic animal, a machine or a device. It rebuilds it in three.js, every shell, gear and fang written as code, checks the build against the picture line by line, and films it: a cursor presses a button, that part comes apart under its own camera, then the whole object explodes and snaps back together.

![Theraphos TH-8 robotic tarantula](docs/tarantula.gif)

| Serrasal PX-7 robotic piranha | Vespion VX-9 robotic wasp |
|---|---|
| ![Serrasal PX-7 robotic piranha](docs/piranha.gif) | ![Vespion VX-9 robotic wasp](docs/wasp.gif) |

## Install

```
npx skills add Nyxera0x/cutaway -g -a claude-code
```

Then, once, in the installed folder:

```
npm install && npx playwright install chromium
```

You need Node.js 20 or newer. For the video you also need `ffmpeg`, and for the sound Python 3.

## Use

Give Claude Code a picture and ask in plain words:

> Here is a robotic mantis. Build it as a 3D object I can take apart, and stop at the still so I can check it.

> Turn this image of a robot crab into a 20-second film where every part comes apart.

> I approved the still. Film it the way the piranha example is filmed.

No picture yet? `docs/PROMPTS.md` has the prompt that generated ours.

Or open one of the 3 examples first:

```
node sims/build.mjs tarantula-film     # cutaway-out/dist/tarantula-film.html
node sims/build.mjs piranha-film
node sims/build.mjs wasp-film
```

And render one as a finished film, scored and with its review sheets, in one command:

```
node film.mjs piranha-film             # cutaway-out/piranha-film.mp4, 1080p 60 fps with sound
node film.mjs wasp-demo                # the 10-second version
```

## How it works

1. **One reference picture** sets the look. Claude reads it and rebuilds it; it never imports it.
2. **A checklist for that picture**: 10 to 12 numbered lines Claude grades yes, partial or no every round.
3. **Measured, not eyeballed**: the share of dark mechanism and the proportions, both against the picture.
4. **A still first.** Claude stops after round 2 and waits for your yes. Nothing gets filmed before it.
5. **The film** reuses the example with the closest body 1:1 and changes the body only. Every part gets its own camera.
6. **A 10-second version** gets its own script, its own opening and its own exit.

The whole method is in `docs/`, written so you can follow it with or without the code.

## What is inside

| | |
|---|---|
| `SKILL.md` | What Claude reads: the order of work, the rules that make it look right, the review loop. |
| `docs/JOB_DESCRIPTION.md` | The brief Claude reads before every object. Your corrections go into it. |
| `docs/CHECKLIST.md`, `docs/PROMPTS.md`, `docs/LESSONS.md` | The checklist format with a full example, every prompt, every mistake and the line it added. |
| `sims/tarantula-*`, `sims/piranha-*`, `sims/wasp-*` | 3 complete objects. `-shared` is the object, `-film` the full film, `-demo` the 10-second version. |
| `sims/green/` | The page around every object and the green look, plus 3 review tools: leftover-colour probe, camera track, part anchors. |
| `sims/kit/` | Runtime, stage, shader warm-up. |
| `sims/build.mjs` | Bundles an object into one HTML file, three.js and fonts inlined. |
| `sims/capture.mjs` | Renders the film frame by frame to a 60 fps mp4, or to review sheets of stills. |
| `sfx/`, `run_sfx.py` | Procedural sound on the film's timeline, mastered to −14 LUFS. |
| `film.mjs` | All of the above in one command: build, 4K capture, score, mux to 1080p, review sheets. |
| `sheet.mjs`, `wave.mjs` | Contact sheets of a rendered video, one tile per beat; the waveform with every beat drawn on it, and its loudness. |
| `check.mjs` | Checks every timeline, bundle and Python file in seconds, no GPU needed. CI runs it on every push (`.github/workflows/check.yml`). |

## When something goes wrong

| | |
|---|---|
| `esbuild is not installed` (or `three`, `playwright`) | Run `npm install && npx playwright install chromium` in the skill's folder once. |
| `ffmpeg not found` | Install ffmpeg, or point `FFMPEG` (and `FFPROBE`) at it. The same goes for `PYTHON` and `CHROMIUM`. |
| Capture prints a software GPU (SwiftShader, llvmpipe) | WebGL fell back to the CPU, so renders are slow. Check the GPU flags in `paths.mjs`. |
| Contact sheets without `t=` labels | Set `CUTAWAY_FONT` to any `.ttf` monospace font. |
| A timeline mistake | `npm run check` names the file and the beat. |

## Credits

Built on [whaleyxbt/claude-motion](https://github.com/whaleyxbt/claude-motion) (MIT): the runtime, frame capture, sound engine and review rules come from there. Recorded samples are CC0 from Freesound, prepared by [Barty-Bart/motion-graphics](https://github.com/Barty-Bart/motion-graphics); sources in `sfx/samples/SOURCES.md`.

MIT licence.
