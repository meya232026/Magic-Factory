// THERAPHOS TH-8, the 10-second demo for the article (2026-11-06), green: the approved film's run-in and landing jump,
// the glass abdomen opening on its coils, the explode, a few steps and the jump at the camera. 11.3 s of the tour
// played at 1.13x (timeline.json: duration = scene seconds, film = film seconds).
import {runTarantulaGreen} from '../tarantula-shared/sim_green.js';
import TL from './timeline.json';

runTarantulaGreen(TL, 'tarantula-demo');
