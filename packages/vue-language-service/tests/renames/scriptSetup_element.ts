import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../../vue-test-workspace/renames/scriptSetup_element.vue');

// renaming tag

const tagResult = `
<template>
    <h2>{{ h1 }}</h2>
</template>

<script lang="ts" setup>
const h1: string = 'header';
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(1, 5),
	newName: 'h2',
	length: 2,
}, { [file]: tagResult });

defineRename({
	fileName: file,
	position: Position.create(1, 18),
	newName: 'h2',
	length: 2,
}, { [file]: tagResult });

// renaming ctx

const ctxResult = `
<template>
    <h1>{{ h2 }}</h1>
</template>

<script lang="ts" setup>
const h2: string = 'header';
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
	position: Position.create(5, 7),
	newName: 'h2',
	length: 2,
}, { [file]: ctxResult });
