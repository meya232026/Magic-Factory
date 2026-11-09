"""Procedural sound design for motion graphics. Pure Python stdlib, 48 kHz stereo.

    python run_sfx.py sims/piranha-shared/score.py   render a cue sheet to WAV
    python run_sfx.py --list                         list the sound generators
"""

from .mix import Mix
from .synth import SR

__all__ = ["Mix", "SR"]
