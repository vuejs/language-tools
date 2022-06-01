import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../../vue-test-workspace/renames/cssScoped.vue');
const fileResult = `
<template>
    <div class="bar"></div>
</template>

<style scoped>
.bar { }
</style>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(5, 0),
	newName: '.bar',
	length: 5,
}, { [file]: fileResult });

defineRename({
	fileName: file,
	position: Position.create(1, 16),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });
