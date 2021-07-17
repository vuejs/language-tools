import * as path from 'upath';
import { Position } from "vscode-languageserver/node";
import { defineRename } from "../utils/defineRename";

defineRename({
	fileName: path.resolve(__dirname, '../../testCases/cssModule.vue'),
	actions: [
		{
			position: Position.create(5, 0),
			newName: '.bar',
			length: 5,
		},
		{
			position: Position.create(1, 24),
			newName: 'bar',
			length: 4,
		},
	],
	result: `
<template>
    <div :class="$style.bar"></div>
</template>

<style module>
.bar { }
</style>`.trim(),
});
