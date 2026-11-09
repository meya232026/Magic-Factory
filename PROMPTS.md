# Prompts

Every prompt in the order you use them. Replace the parts in [brackets].

## 1. The reference image

For ChatGPT or any image model:

```
A robotic [hammerhead shark] as a precision machine, studio product shot on a near-white background with a soft floor shadow.
White glossy shells with clearcoat, green only on tips, rims, edges and joint rings.
Dense dark mechanism showing through cut-outs and clear glass: gears, pistons, hoses, small screws.
Eyes as glossy black lenses with a thin green ring. Fins and membranes milky and frosted with thin veins.
Front three-quarter view, the whole animal in frame.
```

Pick an animal with many joints and a dense core. Give it one main set of limbs. Smooth bodies (snakes, shells, rays) read as toys however many rounds they get.

## 2. The still loop

```
Read JOB_DESCRIPTION.md and this checklist. Build the [piranha] and loop:
1. Render a still at 1600x900 posed like the reference.
2. Stack the reference, your still and the approved still side by side, plus a thumbnail of the same stack 900 px wide.
3. Grade every checklist line yes, partial or no, one line each.
4. Fix the no's, then the partials.
Stop after round 2 and show me the stack and the grades. Wait for my notes before round 3.
```

Then grade it yourself, against the picture and not against your memory of it.

## 3. Measuring

```
Crop the reference and your still to the animal's bounding box.
Density: count the share of dark pixels (luma under 80). Yours has to reach 0.8 of the reference's. Raise it by breaking white surfaces into separate plates with gaps over the mechanism; adding dots does not count.
Proportions: measure body height, head length and jaw or limb length as shares of the body length, the same way on both images. Report both numbers side by side.
```

## 4. Round notes

When you send Claude back for another round, give numbers, not adjectives:

```
Round [3]. Fix these in order, measure each on your still and on the reference, report both:
1. [The biggest problem, with the target number: "jaws at 0.36 of the body length, yours are 0.52".]
2. [The next one: "green as lines only, zero isolated dots".]
3. ...
Grade each item yes / partial / no against the reference. Save round[3]_still.png and round[3]_compare.jpg and stop.
```

## 5. The film

```
Take the approved film of the animal whose body is closest to this one and port it 1:1: the same beat times, the same moves, distances scaled to the animal. Change the body only.
Map its parts onto the slots: [the eye, the tail, the flank, the jaw].
Each part opens in about 1 s, holds with its parts still spinning, and closes in 0.5 s. Give every part its own camera: its own side and height, aimed at the part, pushing in while it hangs open.
Then a full explode on a turntable, a fast reassembly while it turns, and an exit.
Build a page around it: an invented product name and title, one pill button per part that a cursor clicks, live cards that move with the parts.
Before you show me the film, put its frames at 1.5, 4.5 and 12.4 s next to the approved film's. If it looks smaller, flatter or blurrier, it doesn't ship.
```

## 6. The short version

```
Write a 10-second version as its own script: the opening, one part ([the jaw]), the explode, the exit. Do not cut pieces out of the long film.
Give it its own opening and exit, different from the other animals'.
If the scene needs more than 10 seconds, play it back faster, up to 1.15x, and stretch the sound by the same factor.
```

## 7. Render and sound

```
Render the film frame by frame: render(t) is a pure function of time. Capture at 1600x900 with a device pixel ratio of 2.4, downscale to 1920x1080 at 60 fps with lanczos, H.264, yuv420p, faststart.
Score it in code on the same script: a music bed for the whole film, a quiet click per button, a short accent on every part that moves. Master to -14 LUFS.
```

A screen recorder drops frames when the GPU works hard. A film rendered frame by frame cannot.
