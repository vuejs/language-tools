import * as path from 'upath';
import * as vscode from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file_from = path.resolve(__dirname, '../../testCases/renames/typeProp_from.vue');
const file_to = path.resolve(__dirname, '../../testCases/renames/typeProp_to.vue');
const fileResult_from = `
<template>{{ barFoo }}</template>

<script lang="ts" setup>
defineProps<{ barFoo: string }>();
</script>
`.trim();
const fileResult_to = `
<template>
	<Comp :bar-foo="'foo'"></Comp>
	<Comp :barFoo="'foo'"></Comp>
</template>

<script lang="ts" setup>
import Comp from './typeProp_from.vue';
</script>
`.trim();

defineRename({
	fileName: file_from,
	position: vscode.Position.create(0, 13),
	newName: 'barFoo',
	length: 6,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});

defineRename({
	fileName: file_from,
	position: vscode.Position.create(3, 14),
	newName: 'barFoo',
	length: 6,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});

defineRename({
	fileName: file_to,
	position: vscode.Position.create(1, 9),
	newName: 'bar-foo',
	length: 7,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});

defineRename({
	fileName: file_to,
	position: vscode.Position.create(2, 9),
	newName: 'barFoo',
	length: 6,
}, {
	[file_from]: fileResult_from,
	[file_to]: fileResult_to,
});
