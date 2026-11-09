"""Score for the THERAPHOS TH-8 tarantula (entries tarantula-film and tarantula-demo; first the SALTICUS JS-8 jumping
spider's score), after the scorpion's: a bed for the whole film (D minor, 100 bpm, e-piano, bass, soft drums and a pad on the same changes)
at one level, a quiet click on every button press, and short quiet accents on the spider's own moves: soft servo
ticks under the steps, a tension rise in each crouch, a whoosh on each take-off and a thud on the first landing,
thread ticks as the lenses unscrew and screw back, servo blips down the front leg, a lift of air as the canopy opens
and the head's plates lift, two fang snaps, a whoosh into the explode and three clicks as it seats, and the one low
impact of the film on the last landing.

    python run_sfx.py sims/tarantula-shared/score.py

Every cue comes from the script in tarantula-film/timeline.json (TL=<path>/tarantula-demo/timeline.json scores the
demo's scene, to be stretched to film length), with the offsets inside each act taken from tour.js
(ACT, the two jumps J1 and J2, the walk keys, the explode out 0.2-1.8 s and home 0-1.0 s).
"""

import os


from sfx.score_kit import airy, bed, chords, hz  # noqa: E402
from sfx.synth import blip, click, envelope, impact, pad, whoosh  # noqa: E402

TIMELINE = os.environ.get("TL", "../tarantula-film/timeline.json")
OUT = os.environ.get("OUT", os.path.join(os.environ.get("CUTAWAY_OUT", "cutaway-out"), "tarantula-score.wav"))
TARGET_LUFS = -14.0
SEED = 37

CHORDS = chords("Dm9:D3 F3 A3 C4 E4/D2", "A#maj7:A#2 D3 F3 A3/A#1", "Gm9:G2 A#2 D3 F3 A3/G1", "A7sus:A2 D3 E3 G3/A1")
MOTIF = [(0.5, hz("A5")), (1.5, hz("F5")), (2.5, hz("E5"))]
STRIDE = 2.7
# the first jump, fixed in tour.js: crouch, lift-off, touch-down
J1 = (1.5, 1.98, 2.55)


def steps(mix, t0, t1, level=0.012):
    """Soft servo ticks, two per stride (one per group of four feet landing), panned with the stepping side."""
    t = t0
    i = 0
    while t < t1:
        mix.put(t, click(1500 + 120 * (i % 3), 0.02), level, pan=-0.25 if i % 2 else 0.25)
        t += 0.5 / STRIDE
        i += 1


def jump(mix, t0, tl, ta, last=False):
    """A crouch that winds up, the take-off whoosh, the landing: a soft thud, or the film's one impact."""
    mix.put(t0, airy(tl - t0, 300, 1100, 0.8), 0.022)
    mix.put(tl - 0.04, whoosh(0.5, 600, 2800, peak=0.45), 0.045)
    for i in range(4):
        mix.put(tl - 0.1 + 0.02 * i, click(1800 + 200 * i, 0.015), 0.025, pan=-0.3 + 0.2 * i)
    if last:
        mix.put(ta, impact(1.2), 0.22)
    else:
        mix.put(ta, click(900, 0.05), 0.07)
        mix.put(ta + 0.005, blip(hz("D3"), 0.25, 0.08), 0.06)
    for i in range(3):
        mix.put(ta + 0.08 + 0.05 * i, click(2200 - 150 * i, 0.015), 0.025, pan=-0.2 + 0.2 * i)


def snap(mix, t, level=0.045, pan=0.0):
    """A fang snapping shut: a hard click with a short tonal knock under it."""
    mix.put(t, click(2600, 0.03), level, pan=pan)
    mix.put(t + 0.004, blip(hz("D5"), 0.12, 0.04), level * 0.35, pan=pan)


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 100, CHORDS, MOTIF, motif_voice="blip", kicks=(0, 2.5), snares=(1, 3), hats=8, swing=0.08, keys_vel=0.75, keys_lp=3800)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.05)
    bar = 4 * 60 / 100
    changes = [(0.12 + b * bar, [f for f in CHORDS[b % len(CHORDS)][0][:4]]) for b in range(int(dur / bar) + 1)]
    pl, pr = pad(dur, changes, volume=envelope([(0, 0), (1.0, 1), (dur - 1.6, 1), (dur, 0)]), detune=0.8, tremolo=0.18, xfade=0.5)
    mix.put_stereo(0, pl, pr, 0.07)

    acts = {e["act"]: e["t"] for e in tl["script"]}
    # the run-in and the first jump at the camera
    steps(mix, 0.0, 1.9)
    jump(mix, *J1)

    for e in tl["script"]:
        t, act = e["t"], e["act"]
        mix.put(t, click(2400, 0.025), 0.055, pan=0.45)
        if act == "eyes":
            for i, dt in enumerate((0.35, 0.5, 0.65, 0.8, 0.95)):
                mix.put(t + dt, click(3300 - 180 * i, 0.016), 0.032, pan=0.1)
            mix.put(t + 0.9, blip(hz("A6"), 0.2, 0.06), 0.018)
            for i, dt in enumerate((1.95, 2.1, 2.25, 2.4)):
                mix.put(t + dt, click(2600 + 180 * i, 0.016), 0.028, pan=0.1)
        elif act == "leg":
            mix.put(t + 0.05, airy(0.5, 600, 1500, 0.5), 0.016, pan=0.35)
            for i, dt in enumerate((0.55, 0.75, 0.95, 1.15, 1.35)):
                mix.put(t + dt, blip(hz("D6") * 2 ** (i / 6), 0.18, 0.06), 0.02, pan=0.35)
            mix.put(t + 2.5, click(2000, 0.03), 0.05, pan=0.35)
        elif act == "abdomen":
            mix.put(t + 0.3, airy(1.1, 450, 1500, 0.6), 0.026, pan=-0.2)
            for i, dt in enumerate((0.7, 0.85, 1.0)):
                mix.put(t + dt, click(2800 - 200 * i, 0.018), 0.026, pan=-0.2)
            mix.put(t + 2.5, click(2100, 0.03), 0.055, pan=-0.2)
        elif act == "head":
            mix.put(t + 0.3, airy(1.0, 500, 1700, 0.6), 0.024)
            snap(mix, t + 0.95, 0.04, -0.15)
            snap(mix, t + 1.45, 0.04, 0.15)
            # the flared fangs snapping shut as the head closes
            snap(mix, t + 2.38, 0.05, 0.0)
            mix.put(t + 2.45, click(2100, 0.03), 0.05)
        elif act == "exploded":
            mix.put(t + 0.2, airy(1.4, 500, 2600, 0.7), 0.032, pan=-0.15)
            mix.put(t + 0.25, blip(hz("D6"), 0.3, 0.1), 0.025)
        elif act == "assemble":
            mix.put(t, airy(1.0, 2200, 600, 0.5), 0.02, pan=0.15)
            for i, dt in enumerate((0.6, 0.8, 1.0)):
                mix.put(t + dt, click(2000 + 300 * i, 0.03), 0.05, pan=-0.3 + 0.3 * i)
            mix.put(t + 1.15, whoosh(0.5, 800, 2200, peak=0.5), 0.022)
        elif act == "hero":
            steps(mix, t + 0.4, acts.get("jump", t + 3.0) + 0.4)
        elif act == "jump":
            jump(mix, t + 0.25, t + 0.72, t + 1.3, last=True)
