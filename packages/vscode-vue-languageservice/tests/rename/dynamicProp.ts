import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/dynamicProp.vue'),
	actions: [
		{
			position: Position.create(1, 11),
			newName: 'bar',
			length: 4,
		},
		{
			position: Position.create(5, 6),
			newName: 'bar',
			length: 4,
		},
	],
	result: `
<template>
    <div :[bar]="123"></div>
</template>

<script lang="ts" setup>
const bar = 'foo';
</script>`.trim(),
});
