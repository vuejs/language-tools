import * as path from 'upath';
import { defineTypeCheck } from './utils/defineTypeCheck';

import './completions/import_path';

import './renames/prop';
import './renames/typeProp';
import './renames/cssModules';
import './renames/cssScoped';
import './renames/cssVars';
import './renames/dynamicProp';
import './renames/scriptSetup_component';
import './renames/scriptSetup_element';
import './renames/scriptSetup';

defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/events.vue'));
defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/scriptSetup_scope.vue'));
defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/slots.vue'));
defineTypeCheck(path.resolve(__dirname, '../../vue-test-workspace/typeChecks/v_for.vue'));
