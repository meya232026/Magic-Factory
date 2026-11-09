// VESPION VX-9, the 10-second demo for the article (2026-11-06), green: a dive in from above, the wing pulled out and
// turned over, the explode in slow motion, a climb straight out of the top of the frame. Tour: ../wasp-shared/tour_10.js.
import {runWaspGreen} from '../wasp-shared/sim_green.js';
import {make10Tour} from '../wasp-shared/tour_10.js';
import TL from './timeline.json';

runWaspGreen(TL, 'wasp-demo', {tour: make10Tour});
