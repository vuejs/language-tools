import * as path from 'upath';
import { Position } from 'vscode-languageserver-protocol';
import { defineRename } from '../utils/defineRename';

const file = path.resolve(__dirname, '../../testCases/renames/scriptSetup_component.vue');
const fileResult1 = `
<template>
    <CcDd></CcDd>
    <cc-dd></cc-dd>
</template>

<script lang="ts" setup>
import CcDd from './scriptSetup.vue';
</script>
`.trim();
const fileResult2 = `
<template>
    <CcDd></CcDd>
    <aa-bb></aa-bb>
</template>

<script lang="ts" setup>
import AaBb from './scriptSetup.vue';
</script>
`.trim();
const fileResult3 = `
<template>
    <AaBb></AaBb>
    <cc-dd></cc-dd>
</template>

<script lang="ts" setup>
import AaBb from './scriptSetup.vue';
</script>
`.trim();

defineRename({
	fileName: file,
	position: Position.create(6, 7),
	newName: 'CcDd',
	length: 5,
}, { [file]: fileResult1 });

defineRename({
	fileName: file,
	position: Position.create(1, 5),
	newName: 'CcDd',
	length: 5,
}, { [file]: fileResult2 });

defineRename({
	fileName: file,
	position: Position.create(1, 12),
	newName: 'CcDd',
	length: 5,
}, { [file]: fileResult2 });

defineRename({
	fileName: file,
	position: Position.create(2, 5),
	newName: 'cc-dd',
	length: 6,
}, { [file]: fileResult3 });

defineRename({
	fileName: file,
	position: Position.create(2, 13),
	newName: 'cc-dd',
	length: 6,
}, { [file]: fileResult3 });
