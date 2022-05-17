import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../../vue-test-workspace/renames/cssModules.vue');
const fileResult = `
<template>
    <div :class="$style.bar"></div>
</template>

<style module>
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
	position: Position.create(1, 24),
	newName: 'bar',
	length: 4,
}, { [file]: fileResult });
