import * as path from 'upath';
import { Position } from "vscode-languageserver/node";
import { defineRename } from "../utils/defineRename";

defineRename({
    fileName: path.resolve(__dirname, '../../testCases/scriptSetup_refSugar.vue'),
    actions: [
        {
            position: Position.create(3, 8),
            newName: 'bar',
            length: 4,
        },
        {
            position: Position.create(0, 13),
            newName: 'bar',
            length: 4,
        },
        {
            position: Position.create(7, 0),
            newName: 'bar',
            length: 4,
        },
    ],
    result: `
<template>{{ bar }}</template>

<script lang="ts" setup>
ref: ({ foo: bar } = useFoo());
function useFoo() {
    return { foo: '' };
}
bar;
</script>`.trim(),
});

defineRename({
    fileName: path.resolve(__dirname, '../../testCases/scriptSetup_refSugar.vue'),
    actions: [
        {
            position: Position.create(5, 13),
            newName: 'bar',
            length: 4,
        },
    ],
    result: `
<template>{{ foo }}</template>

<script lang="ts" setup>
ref: ({ bar: foo } = useFoo());
function useFoo() {
    return { bar: '' };
}
foo;
</script>`.trim(),
});
