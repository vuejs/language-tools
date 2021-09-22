import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../testCases/scriptSetup_prop.vue');
const fileResult = `
<template>{{ bar }}</template>

<script lang="ts" setup>
defineProps({ bar: String });
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(3, 14),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(0, 13),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });
