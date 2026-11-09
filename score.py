"""Score for the SERRASAL PX-7 piranha (entries piranha-film and piranha-demo). It is the VESPER AX-6 anglerfish's
score, kept because the piranha runs the angler's tour (tour_bee.js) 1:1, cut on the bee's and mixed like the
hummingbird's: a bed in D minor (Dm9, Bbmaj7, Gm9, A7sus at 92 bpm: e-piano, bass, soft
drums and a pad on the same changes) at one level the whole way, a quiet click on every button press, and for every act
short quiet accents on its own moves: a slow wash for the swim-in and a snap as the jaw shuts at its end, thread ticks
as the lens rings unscrew and screw back, a swish as the fin leaves its root, air through its turn and a snap as it
seats, a servo tick per lure link, a run of glass ticks as the cage blooms and a soft rising tone for the flare, a
hinge click per rib shield and servo blips as the drive rings slide out, a drop and a run of glass ticks along the fang
rows and a snap as the jaw seats, a whoosh into the explode and three clicks as the fish seats again, a rising air on
the wind-up and a snap and a rush for the lunge. No drones.

    python run_sfx.py sims/piranha-shared/score.py

Every cue comes from the script in piranha-film/timeline.json (TL=<path>/piranha-demo/timeline.json scores the demo's
scene, to be stretched to film length), with the offsets inside each act taken from
tour_bee.js (the bee's ACT clocks, WING_FLIP, CAGE, FLARE, the snap at 2.3 s, the explode out 0.2-1.8 s and home
0-1.0 s, the lunge 1.0 s after HERO).
"""

import os


from sfx.score_kit import airy, bed, chords, hz, thud  # noqa: E402
from sfx.synth import blip, click, envelope, pad  # noqa: E402

# TL / OUT in the environment score another cut of the film (piranha-demo) without touching this one
TIMELINE = os.environ.get("TL", "../piranha-film/timeline.json")
OUT = os.environ.get("OUT", os.path.join(os.environ.get("CUTAWAY_OUT", "cutaway-out"), "piranha-score.wav"))
TARGET_LUFS = -14.0
SEED = 41

CHORDS = chords("Dm9:D3 F3 A3 C4 E4/D2", "Bbmaj7:Bb2 D3 F3 A3 D4/Bb1", "Gm9:G2 Bb2 D3 F3 A3/G1", "A7sus:A2 D3 E3 G3 C4/A1")
MOTIF = [(0.5, hz("A5")), (1.5, hz("F5")), (2.5, hz("E5"))]
SNAP_IN = 2.3
DEP = 1.0


def snap(mix, t, level=0.06, pan=0.0):
    """The jaw shutting: a short click on a soft low knock."""
    mix.put(t, click(1500, 0.03), level, pan=pan)
    mix.put(t, thud(110, 0.06, 0.25), level * 0.5, pan=pan)


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="blip", kicks=(0, 2.5), snares=(1, 3), hats=8, swing=0.08, keys_vel=0.75, keys_lp=3600)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.05)
    bar = 4 * 60 / 92
    changes = [(0.12 + b * bar, [f for f in CHORDS[b % len(CHORDS)][0][:4]]) for b in range(int(dur / bar) + 1)]
    pl, pr = pad(dur, changes, volume=envelope([(0, 0), (1.0, 1), (dur - 1.6, 1), (dur, 0)]), detune=0.8, tremolo=0.18, xfade=0.5)
    mix.put_stereo(0, pl, pr, 0.07)
    # the swim-in and the snap at its end
    mix.put(0.0, airy(2.4, 400, 1200, 0.6), 0.02, pan=-0.3)
    snap(mix, SNAP_IN + 0.12, 0.05, pan=0.2)

    for e in tl["script"]:
        t, act = e["t"], e["act"]
        mix.put(t, click(2400, 0.025), 0.055, pan=0.45)
        if act == "optics":
            mix.put(t + 0.35, airy(0.6, 1200, 2600, 0.5), 0.012, pan=-0.15)
            for i, dt in enumerate((0.45, 0.62, 0.79, 0.96, 1.13)):
                mix.put(t + dt, click(3200 - 180 * i, 0.018), 0.033, pan=-0.1)
            for i, dt in enumerate((2.2, 2.34, 2.48, 2.6)):
                mix.put(t + dt, click(2500 + 180 * i, 0.018), 0.03, pan=-0.1)
        elif act == "wing":
            mix.put(t + 0.45, airy(0.8, 600, 2000, 0.6), 0.024, pan=-0.3)
            mix.put(t + 0.9, airy(1.4, 800, 1400, 0.5), 0.016, pan=-0.2)
            mix.put(t + 2.35, airy(0.35, 1800, 800, 0.5), 0.012, pan=-0.3)
            mix.put(t + 2.68, click(1800, 0.03), 0.06, pan=-0.2)
        elif act == "leg":
            for k in range(7):
                mix.put(t + 0.35 + 0.07 * k, click(2800 + 90 * k, 0.016), 0.028, pan=0.3)
            for j in range(12):
                mix.put(t + 0.78 + 0.05 * (j % 4) + 0.012 * j, click(3600 + 60 * j, 0.012), 0.018, pan=0.35)
            mix.put(t + 1.05, blip(hz("D6"), 0.6, 0.25), 0.014, pan=0.35)
            mix.put(t + 1.05, airy(0.8, 900, 2400, 0.5), 0.012, pan=0.35)
            for k in range(4):
                mix.put(t + 2.15 + 0.09 * k, click(2600 - 120 * k, 0.016), 0.026, pan=0.3)
            mix.put(t + 2.55, click(1900, 0.03), 0.05, pan=0.3)
        elif act == "thorax":
            for k in range(5):
                mix.put(t + 0.3 + 0.077 * k, click(2300 - 90 * k, 0.022), 0.034, pan=0.1)
            for i, dt in enumerate((0.6, 0.85, 1.1)):
                mix.put(t + dt, blip(hz("A5") * 2 ** (i / 6), 0.18, 0.06), 0.016)
            mix.put(t + 2.1, airy(0.4, 1600, 800, 0.5), 0.011)
            mix.put(t + 2.6, click(2100, 0.03), 0.055)
        elif act == "abdomen":
            mix.put(t + 0.3, airy(0.7, 1400, 500, 0.6), 0.02, pan=0.15)
            for j in range(12):
                mix.put(t + 0.38 + 0.045 * j, click(3300 + 70 * j, 0.012), 0.02, pan=0.1 + 0.03 * j)
            mix.put(t + 2.0, airy(0.4, 600, 1600, 0.5), 0.012, pan=0.15)
            snap(mix, t + 2.42, 0.06, pan=0.15)
        elif act == "exploded":
            mix.put(t + 0.2, airy(1.4, 450, 2400, 0.7), 0.032, pan=-0.15)
            mix.put(t + 0.25, blip(hz("D6"), 0.3, 0.1), 0.025)
        elif act == "assemble":
            mix.put(t, airy(1.0, 2200, 600, 0.5), 0.02, pan=0.15)
            for i, dt in enumerate((0.6, 0.8, 1.0)):
                mix.put(t + dt, click(2000 + 300 * i, 0.03), 0.05, pan=-0.3 + 0.3 * i)
            mix.put(t + 0.9, airy(0.6, 400, 1300, 0.6), 0.016)
        elif act == "hero":
            mix.put(t + 0.1, airy(0.9, 500, 1500, 0.5), 0.016, pan=0.2)
            snap(mix, t + DEP + 0.12, 0.065, pan=0.3)
            mix.put(t + DEP, airy(2.2, 450, 2600, 0.7), 0.032, pan=0.45)
