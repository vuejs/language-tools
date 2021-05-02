import * as path from 'upath';
import { Position } from "vscode-languageserver/node";
import { defineRename } from "../utils/defineRename";

defineRename({
    fileName: path.resolve(__dirname, '../../testCases/cssScoped.vue'),
    actions: [
        {
            position: Position.create(5, 0),
            newName: '.bar',
            length: 5,
        },
        {
            position: Position.create(1, 16),
            newName: 'bar',
            length: 4,
        },
    ],
    result: `
<template>
    <div class="bar"></div>
</template>

<style scoped>
.bar { }
</style>`.trim(),
});
