import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup_element.vue'),
	actions: [
		{
			position: Position.create(1, 5),
			newName: 'h2',
			length: 2,
		},
		{
			position: Position.create(1, 18),
			newName: 'h2',
			length: 2,
		},
	],
	result: `
<template>
    <h2>{{ h1 }}</h2>
</template>

<script lang="ts" setup>
declare const h1: string;
</script>`.trim(),
});

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup_element.vue'),
	actions: [
		{
			position: Position.create(1, 11),
			newName: 'h2',
			length: 2,
		},
		{
			position: Position.create(5, 14),
			newName: 'h2',
			length: 2,
		},
	],
	result: `
<template>
    <h1>{{ h2 }}</h1>
</template>

<script lang="ts" setup>
declare const h2: string;
</script>`.trim(),
});
