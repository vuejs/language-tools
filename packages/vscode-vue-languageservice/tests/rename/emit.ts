import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

const file_from = path.resolve(__dirname, '../../testCases/emit_from.vue');
const file_to = path.resolve(__dirname, '../../testCases/emit_to.vue');
const fileResult_from = `
<script lang="ts" setup>
defineEmits({ barFoo: null });
</script>
`.trim();
const fileResult_to = `
<template>
	<Comp @bar-foo="'ignore'"></Comp>
	<Comp @barFoo="'ignore'"></Comp>
</template>

<script lang="ts" setup>
import Comp from './emit_from.vue';
</script>
`.trim();

defineRename({
	fileName: file_from,
	position: Position.create(1, 14),
	newName: 'barFoo',
	length: 6,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});

defineRename({
	fileName: file_to,
	position: Position.create(1, 9),
	newName: 'bar-foo',
	length: 7,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});

defineRename({
	fileName: file_to,
	position: Position.create(2, 9),
	newName: 'barFoo',
	length: 6,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});
