# Job description

Copy this file into your project. Tell Claude to read it before every animal. When you correct Claude, the correction goes into this file, one line per mistake.

```
You build robotic animals from a reference image, in three.js, entirely in code.

THE LOOK
- white shells with clearcoat and an environment map
- green as a sparse accent only: tips, rims, edge lines, a bezel, joint rings; never dots sprinkled over a shell
- dark mechanism in 2 levels: big parts (gears, rings, actuators) and about 260 small ones (pistons, hoses, screws, wiring); cut windows into the shells so the dark mass shows
- glowing parts (coils, rings) sit inside the mechanism or behind clear glass, never on the surface
- eyes as glossy black lenses with a thin green bezel and a small pupil
- membranes milky and frosted with thin veins
- every limb has its own pose and segment lengths, never a row of identical parts
- bristles and spikes thin and short: 0.15 to 0.25 of the limb's thickness
- one main set of limbs per animal (legs, or wings, or tentacles)
- near-white studio, soft floor shadow

THE ORDER
1. Measure the reference first: body height, head length, jaw or limb length, as shares of the body length. Write the numbers down.
2. Build every part that will come apart as its own group, with a named anchor point, so the film can open it later.
3. Render one still at 1600x900 posed like the reference.
4. Stack the reference, your still and an approved still side by side, plus the same stack at 900 px wide. Grade every checklist line yes, partial or no. Grade against the picture, not against what you remember building.
5. Grade one more line every round: at 900 px wide, does it look as dense as the approved still?
6. Measure: the share of dark pixels (luma under 80) in the animal's bounding box, yours against the reference's. Below 0.8 of it is a no. Measure your proportions the same way as the reference's.
7. Stop after round 2 and show me. Nothing gets filmed until I say yes.

THE CAMERA
- frame 0 is the front 3/4 hero view, the animal big and already moving
- every teardown gets its own side, height and distance, aimed at the part itself, pushing in while it hangs open: an eye in macro, a tail from behind, a back from above, a jaw from below; never two beats from the same spot
- the part being opened stays in view; the rest of the animal may run off the frame
- smooth paths only: the camera never copies a wing beat or a footstep
- visible wing beats stay slow, 1.5 to 2.5 Hz

THE FILM
- port the approved film of the animal whose body is closest: the same beat times and moves, distances scaled to the animal; change the body only
- a part opens in about 1 s, holds with its parts still spinning, closes in 0.5 s; a beat every 2 to 3 s
- then a full explode on a turntable, a fast reassembly while it turns, and an exit
- the page around it: an invented product name and title, one button per part that a cursor clicks, live cards that move with the parts, labels on the parts while they hang open
- everything is a pure function of time t; the script lives in one file the picture and the sound both read

THE SHORT VERSION
- its own script: the opening, one part, the explode, the exit; never pieces of the long film joined together
- its own opening and its own exit, different from every other animal's
- if the scene runs longer than the target, play it back faster (up to about 1.15x) and stretch the sound by the same factor
```

## Why these lines

- **"Grade against the picture"** keeps the self-check honest. Claude grades its own memory of the build as "yes" otherwise.
- **"Nothing gets filmed until I say yes"** keeps tokens from burning on a film of a toy.
- **"The correction goes into this file"** is how animal 5 stops repeating the mistakes of animal 1.
- **The camera section** came from a film where every beat sat between 20° and 50° on one side, at one height and one distance. It looked parked.
