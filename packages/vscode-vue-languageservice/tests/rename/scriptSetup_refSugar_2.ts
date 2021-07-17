import * as path from 'upath';
import { Position } from "vscode-languageserver/node";
import { defineRename } from "../utils/defineRename";

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/scriptSetup_refSugar_2.vue'),
	actions: [
		{
			position: Position.create(3, 18),
			newName: 'bar',
			length: 4,
		},
	],
	result: `
<template>{{ foo }}</template>

<script lang="ts" setup>
ref: ({ bar: foo } = { bar: '' });
foo;
</script>`.trim(),
});
