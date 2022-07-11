import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineCompletion } from '../utils/defineCompletion';

const file = path.resolve(__dirname, '../../../vue-test-workspace/completions/import_path/B.vue');

defineCompletion({
	fileName: file,
	position: Position.create(2, 17),
}, ['A.vue']);
