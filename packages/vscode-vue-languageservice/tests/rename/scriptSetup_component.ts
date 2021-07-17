import * as path from 'upath';
import { Position } from "vscode-languageserver/node";
import { defineRename } from "../utils/defineRename";

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup_component.vue'),
	actions: [
		{
			position: Position.create(6, 7),
			newName: 'CcDd',
			length: 5,
		},
		{
			position: Position.create(1, 5),
			newName: 'CcDd',
			length: 5,
		},
		{
			position: Position.create(1, 12),
			newName: 'CcDd',
			length: 5,
		},
		{
			position: Position.create(2, 5),
			newName: 'cc-dd',
			length: 6,
		},
		{
			position: Position.create(2, 13),
			newName: 'cc-dd',
			length: 6,
		},
	],
	result: `
<template>
    <CcDd></CcDd>
    <cc-dd></cc-dd>
</template>

<script lang="ts" setup>
import CcDd from './scriptSetup.vue';
</script>`.trim(),
});
