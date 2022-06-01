import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../../vue-test-workspace/renames/cssVars.vue');
const fileResult = `
<script lang="ts" setup>
const baz = 1;
</script>

<style>
.bar { color: v-bind(baz); }
.bar { color: v-bind('baz'); }
.bar { color: v-bind("baz"); }
.bar { color: v-bind(baz + baz); }
.bar { color: v-bind('baz + baz'); }
.bar { color: v-bind("baz + baz"); }
.bar { color: v-bind(); }
</style>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(1, 6),
	newName: 'baz',
	length: 4,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(5, 21),
	newName: 'baz',
	length: 4,
}, { [file]: fileResult });
