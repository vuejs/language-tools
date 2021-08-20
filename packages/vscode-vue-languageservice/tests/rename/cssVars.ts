import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/cssVars.vue'),
	actions: [
		{
			position: Position.create(1, 6),
			newName: 'baz',
			length: 4,
		},
		{
			position: Position.create(5, 21),
			newName: 'baz',
			length: 4,
		},
	],
	result: `
<script lang="ts" setup>
const baz = 1;
</script>

<style>
.bar { color: v-bind(baz); }
</style>
`.trim(),
});
