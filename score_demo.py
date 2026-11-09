"""Score for the VESPION VX-9 10-second demo (entry wasp-demo, tour_10.js), first written for the MELLIS HB-7 bee's
short film: the bee films' bed in D minor (Dm9, Bbmaj7,
Gm9, A7sus at 96 bpm: e-piano, bass, soft drums and a pad) at one level the whole way, a quiet click on every button
press, and short quiet accents on each act's own moves: a falling air for the dive in from the left, thread ticks as
the lens unscrews and screws back, a swish as the wing leaves its hinge and another as it turns over and a snap as it
seats, a lift of air and a few gear ticks as the thorax and the abdomen open and a click as they close, a whoosh into
the explode with a long falling air and one low note under the 0.4x speed ramp and slow glass ticks as the parts drift
apart, three clicks as the bee seats again, and a rising air that swells as the bee darts at the lens and passes to
its right. No drones.

    python run_sfx.py sims/wasp-shared/score_demo.py

Every cue comes from wasp-demo/timeline.json. The offsets inside each act are tour_10.js's, in SCENE seconds, and go
through the same speed-ramp warp (RAMP, anchored on EXPLODED) back to film time.
"""

import bisect
import os



from sfx.score_kit import airy, bed, chords, hz  # noqa: E402
from sfx.synth import blip, click, envelope, pad  # noqa: E402

TIMELINE = os.environ.get("TL", "../wasp-demo/timeline.json")
OUT = os.environ.get("OUT", os.path.join(os.environ.get("CUTAWAY_OUT", "cutaway-out"), "wasp-demo-score.wav"))
TARGET_LUFS = -14.0
SEED = 53

CHORDS = chords("Dm9:D3 F3 A3 C4 E4/D2", "Bbmaj7:Bb2 D3 F3 A3/Bb1", "Gm9:G2 Bb2 D3 F3 A3/G1", "A7sus:A2 D3 E3 G3/A1")
MOTIF = [(0.5, hz("A5")), (1.5, hz("F5")), (2.5, hz("E5"))]
# tour_10.js: the ramp in film seconds after the EXPLODED click, and the dart's start after HERO (scene seconds)
RAMP_A, RAMP_B, RAMP_LOW = (0.35, 0.55), (1.9, 2.1), 0.4
DEP = 0.75


def _smoother(x):
    u = min(1.0, max(0.0, x))
    return u * u * u * (u * (u * 6 - 15) + 10)


def make_warp(t_ramp, dur):
    """film time -> scene time and back, the same integral as tour_10.js makeWarp"""
    dt = 1 / 480
    n = int((dur + 2) / dt)
    ts = [i * dt for i in range(n + 1)]
    tau = [0.0]
    for i in range(1, n + 1):
        mid = ts[i] - dt / 2
        bump = _smoother((mid - t_ramp - RAMP_A[0]) / (RAMP_A[1] - RAMP_A[0])) * (1 - _smoother((mid - t_ramp - RAMP_B[0]) / (RAMP_B[1] - RAMP_B[0])))
        tau.append(tau[-1] + (1 - (1 - RAMP_LOW) * bump) * dt)

    def interp(x, xs, ys):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        j = bisect.bisect_right(xs, x) - 1
        k = (x - xs[j]) / (xs[j + 1] - xs[j])
        return ys[j] + (ys[j + 1] - ys[j]) * k

    return (lambda x: interp(x, ts, tau)), (lambda y: interp(y, tau, ts))


def score(mix, tl):
    dur = tl["duration"]
    t_exp = next((e["t"] for e in tl["script"] if e["act"] == "exploded"), 999.0)
    tau_at, film_at = make_warp(t_exp, dur)

    left, right, low, drums = bed(dur, 96, CHORDS, MOTIF, motif_voice="blip", kicks=(0, 2.5), snares=(1, 3), hats=8, swing=0.08, keys_vel=0.75, keys_lp=3800)
    mix.put_stereo(0, left, right, 0.13)
    mix.put(0, low, 0.13)
    mix.put(0, drums, 0.05)
    bar = 4 * 60 / 96
    changes = [(0.12 + b * bar, [f for f in CHORDS[b % len(CHORDS)][0][:4]]) for b in range(int(dur / bar) + 1)]
    pl, pr = pad(dur, changes, volume=envelope([(0, 0), (1.0, 1), (dur - 1.4, 1), (dur, 0)]), detune=0.8, tremolo=0.18, xfade=0.5)
    mix.put_stereo(0, pl, pr, 0.07)
    # the dive in from high on the left
    mix.put(0.0, airy(1.6, 2200, 700, 0.6), 0.024, pan=-0.35)

    for e in tl["script"]:
        t, act = e["t"], e["act"]
        k0 = tau_at(t)

        def at(dt, t0=k0):
            """an offset in scene seconds after the click, in film time"""
            return film_at(t0 + dt)

        mix.put(t, click(2400, 0.025), 0.055, pan=0.45)
        if act == "optics":
            for i, dt in enumerate((0.3, 0.48, 0.66, 0.84)):
                mix.put(at(dt), click(3200 - 200 * i, 0.018), 0.035, pan=0.2)
            for i, dt in enumerate((1.58, 1.71, 1.84)):
                mix.put(at(dt), click(2600 + 200 * i, 0.018), 0.03, pan=0.2)
        elif act == "wing":
            mix.put(at(0.2), airy(0.6, 600, 2200, 0.6), 0.025, pan=-0.3)
            mix.put(at(0.5), airy(0.95, 900, 1500, 0.5), 0.016, pan=-0.2)
            mix.put(at(1.92), click(1800, 0.03), 0.06, pan=-0.2)
        elif act in ("thorax", "abdomen"):
            mix.put(at(0.25), airy(0.8, 500, 1600, 0.6), 0.024)
            for i in range(4):
                mix.put(at(0.55 + 0.11 * i), click(3300 + 140 * i, 0.012), 0.02, pan=0.1 - 0.1 * i)
            mix.put(at(1.9 if act == "thorax" else 1.95), click(2100, 0.03), 0.055)
        elif act == "exploded":
            mix.put(at(0.2), airy(1.0, 500, 2600, 0.7), 0.032, pan=-0.15)
            mix.put(at(0.25), blip(hz("D6"), 0.3, 0.1), 0.024)
            # the ramp: a long falling air under the slowed parts, one low note as time stretches, slow glass ticks
            mix.put(t + RAMP_A[0], airy(RAMP_B[1] - RAMP_A[0] + 0.3, 1800, 450, 0.5), 0.022, pan=-0.1)
            mix.put(t + RAMP_A[1], blip(hz("D4"), 1.1, 0.5), 0.015)
            for i in range(6):
                mix.put(t + RAMP_A[1] + 0.22 * i, click(3600 - 150 * i, 0.012), 0.018, pan=0.4 - 0.16 * i)
        elif act == "assemble":
            mix.put(t, airy(0.8, 2200, 600, 0.5), 0.02, pan=-0.15)
            for i, dt in enumerate((0.45, 0.6, 0.75)):
                mix.put(at(dt), click(2000 + 300 * i, 0.03), 0.05, pan=0.3 - 0.3 * i)
            mix.put(at(0.7), airy(0.5, 400, 1300, 0.6), 0.016)
        elif act == "hero":
            mix.put(at(0.1), airy(0.7, 900, 1600, 0.5), 0.012, pan=-0.1)
            # the dart: a rising air that swells to the pass by the lens and swings right with it
            d0 = at(DEP)
            n = max(0.4, dur - d0)
            mix.put(d0, airy(n, 400, 3000, 0.7), 0.032, pan=0.15)
            mix.put(d0 + n * 0.7, airy(n * 0.3, 2600, 1200, 0.6), 0.03, pan=0.6)
