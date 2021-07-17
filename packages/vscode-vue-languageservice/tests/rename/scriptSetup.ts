import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup.vue'),
	actions: [
		{
			position: Position.create(0, 13),
			newName: 'bar',
			length: 4,
		},
		{
			position: Position.create(3, 5),
			newName: 'bar',
			length: 4,
		},
	],
	result: `
<template>{{ bar }}</template>

<script lang="ts" setup>
ref: bar = 1;
</script>`.trim(),
});
