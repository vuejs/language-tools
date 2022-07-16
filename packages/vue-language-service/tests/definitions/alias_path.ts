import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineDefinition } from '../utils/defineDefinition';

const file = path.resolve(__dirname, '../../../vue-test-workspace/definitions/alias_path/B.vue');

defineDefinition({
	fileName: file,
	position: Position.create(1, 15),
}, ['/definitions/alias_path/A.vue']);
