import * as path from 'upath';
import { defineTypeCheck } from '../utils/defineTypeCheck';

defineTypeCheck(path.resolve(__dirname, '../../test-workspace/typeChecks/events.vue'), []);
