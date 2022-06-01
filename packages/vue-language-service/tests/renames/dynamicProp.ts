import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../../vue-test-workspace/renames/dynamicProp.vue');
const fileResult = `
<template>
    <div :[bar]="123"></div>
</template>

<script lang="ts" setup>
const bar = 'foo';
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(1, 11),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(5, 6),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });
