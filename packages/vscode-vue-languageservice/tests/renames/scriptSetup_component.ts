import * as path from 'upath';
import { Position } from 'vscode-languageserver/node';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../testCases/renames/scriptSetup_component.vue');
const fileResult = `
<template>
    <CcDd></CcDd>
    <cc-dd></cc-dd>
</template>

<script lang="ts" setup>
import CcDd from './scriptSetup.vue';
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(6, 7),
	newName: 'CcDd',
	length: 5,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(1, 5),
	newName: 'CcDd',
	length: 5,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(1, 12),
	newName: 'CcDd',
	length: 5,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(2, 5),
	newName: 'cc-dd',
	length: 6,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(2, 13),
	newName: 'cc-dd',
	length: 6,
}, { [file]: fileResult });
