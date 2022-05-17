import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../../vue-test-workspace/renames/scriptSetup.vue');
const fileResult = `
<template>{{ bar }}</template>

<script lang="ts" setup>
const bar = 1;
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(0, 13),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(3, 6),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });
