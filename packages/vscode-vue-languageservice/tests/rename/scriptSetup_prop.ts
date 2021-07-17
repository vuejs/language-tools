import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup_prop.vue'),
	actions: [
		{
			position: Position.create(4, 14),
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
import { defineProps } from '@vue/runtime-core';
defineProps({ bar: String });
</script>`.trim(),
});
