"""Score for the VESPION VX-9 wasp film (entry wasp-film), the bee's second-cut score with one more cue (the sting
sliding out in the abdomen act). The bee's notes: Score for the MELLIS HB-7 simulator film, second cut (entry robobee-sim2): the same bed as the other bee films (D minor,
96 bpm, e-piano, bass, soft drums and a pad on the same changes) at one level the whole way, a quiet click on every
button press, and for every act short quiet accents on its own moves: thread ticks as the lens unscrews and screws
back, a swish as the wing pulls out and turns over and a snap as it seats, servo ticks down the leg, a lift of air as
the thorax and the abdomen open and a click as they close, a whoosh into the explode and three clicks as the bee seats
again, and a rising air as it banks away. No drones.

    python run_sfx.py sims/wasp-shared/score.py

Every cue comes from the script in wasp-film/timeline.json, with the offsets inside each act taken from tour_v2.js
(ACT, the explode out 0.2-1.8 s and home 0-1.0 s, the departure 1.0 s after HERO).
"""

import os


from sfx.score_kit import airy, bed, chords, hz  # noqa: E402
from sfx.synth import blip, click, envelope, pad  # noqa: E402

TIMELINE = os.environ.get("TL", "../wasp-film/timeline.json")
OUT = os.environ.get("OUT", os.path.join(os.environ.get("CUTAWAY_OUT", "cutaway-out"), "wasp-score.wav"))
TARGET_LUFS = -14.0
SEED = 29

CHORDS = chords("Dm9:D3 F3 A3 C4 E4/D2", "Bbmaj7:Bb2 D3 F3 A3/Bb1", "Gm9:G2 Bb2 D3 F3 A3/G1", "A7sus:A2 D3 E3 G3/A1")
MOTIF = [(0.5, hz("A5")), (1.5, hz("F5")), (2.5, hz("E5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 96, CHORDS, MOTIF, motif_voice="blip", kicks=(0, 2.5), snares=(1, 3), hats=8, swing=0.08, keys_vel=0.75, keys_lp=3800)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.05)
    bar = 4 * 60 / 96
    changes = [(0.12 + b * bar, [f for f in CHORDS[b % len(CHORDS)][0][:4]]) for b in range(int(dur / bar) + 1)]
    pl, pr = pad(dur, changes, volume=envelope([(0, 0), (1.0, 1), (dur - 1.6, 1), (dur, 0)]), detune=0.8, tremolo=0.18, xfade=0.5)
    mix.put_stereo(0, pl, pr, 0.07)
    # the fly-in: one air that follows the bank
    mix.put(0.0, airy(2.4, 700, 1800, 0.6), 0.02, pan=-0.3)

    for e in tl["script"]:
        t, act = e["t"], e["act"]
        mix.put(t, click(2400, 0.025), 0.055, pan=0.45)
        if act == "optics":
            for i, dt in enumerate((0.4, 0.62, 0.84, 1.06)):
                mix.put(t + dt, click(3200 - 200 * i, 0.018), 0.035, pan=0.2)
            for i, dt in enumerate((2.2, 2.36, 2.52)):
                mix.put(t + dt, click(2600 + 200 * i, 0.018), 0.03, pan=0.2)
        elif act == "wing":
            mix.put(t + 0.45, airy(0.8, 600, 2200, 0.6), 0.025, pan=-0.3)
            mix.put(t + 0.9, airy(1.4, 900, 1500, 0.5), 0.016, pan=-0.2)
            mix.put(t + 2.68, click(1800, 0.03), 0.06, pan=-0.2)
        elif act == "leg":
            for i, dt in enumerate((0.38, 0.6, 0.82, 1.04)):
                mix.put(t + dt, blip(hz("D6") * 2 ** (i / 6), 0.18, 0.06), 0.02, pan=0.1)
            mix.put(t + 2.55, click(2000, 0.03), 0.05)
        elif act in ("thorax", "abdomen"):
            mix.put(t + 0.3, airy(1.0, 500, 1600, 0.6), 0.024)
            mix.put(t + (2.6 if act == "thorax" else 2.45), click(2100, 0.03), 0.055)
            if act == "abdomen":
                # the sting slides out of its collar and back
                mix.put(t + 1.05, blip(hz("A5"), 0.22, 0.07), 0.018, pan=-0.2)
                mix.put(t + 1.5, click(2900, 0.02), 0.035, pan=-0.2)
                mix.put(t + 2.15, click(2500, 0.02), 0.03, pan=-0.2)
        elif act == "exploded":
            mix.put(t + 0.2, airy(1.4, 500, 2600, 0.7), 0.032, pan=-0.15)
            mix.put(t + 0.25, blip(hz("D6"), 0.3, 0.1), 0.025)
        elif act == "assemble":
            mix.put(t, airy(1.0, 2200, 600, 0.5), 0.02, pan=0.15)
            for i, dt in enumerate((0.6, 0.8, 1.0)):
                mix.put(t + dt, click(2000 + 300 * i, 0.03), 0.05, pan=-0.3 + 0.3 * i)
            mix.put(t + 0.9, airy(0.6, 400, 1300, 0.6), 0.016)
        elif act == "hero":
            mix.put(t + 1.0, airy(2.0, 500, 2400, 0.7), 0.03, pan=0.4)
