import * as path from 'upath';
import { defineTypeCheck } from './utils/defineTypeCheck';

import './completions/import_path';

import './definitions/alias_path';

import './rename';

defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/events.vue'));
defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/scriptSetup_scope.vue'));
defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/slots.vue'));
defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/v_for.vue'));
