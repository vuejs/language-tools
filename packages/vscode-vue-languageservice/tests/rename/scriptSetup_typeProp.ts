import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup_typeProp.vue'),
	actions: [
		{
			position: Position.create(3, 14),
			newName: 'bar',
			length: 4,
		},
		{
			position: Position.create(0, 13),
			newName: 'bar',
			length: 4,
		},
	],
	result: `
<template>{{ bar }}</template>

<script lang="ts" setup>
defineProps<{ bar: string }>();
</script>`.trim(),
});
