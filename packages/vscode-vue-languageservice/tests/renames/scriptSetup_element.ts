import * as path from 'upath';
import { Position } from 'vscode-languageserver';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../testCases/renames/scriptSetup_element.vue');

// renaming tag

const tagResult = `
<template>
    <h2>{{ h1 }}</h2>
</template>

<script lang="ts" setup>
declare const h1: string;
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(1, 5),
	newName: 'h2',
	length: 2,
	resultFileNums: 2,
}, { [file]: tagResult });

defineRename({
	fileName: file,
	position: Position.create(1, 18),
	newName: 'h2',
	length: 2,
	resultFileNums: 2,
}, { [file]: tagResult });

// renaming ctx

const ctxResult = `
<template>
    <h1>{{ h2 }}</h1>
</template>

<script lang="ts" setup>
declare const h2: string;
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(1, 11),
	newName: 'h2',
	length: 2,
}, { [file]: ctxResult });

defineRename({
	fileName: file,
	position: Position.create(5, 14),
	newName: 'h2',
	length: 2,
}, { [file]: ctxResult });
