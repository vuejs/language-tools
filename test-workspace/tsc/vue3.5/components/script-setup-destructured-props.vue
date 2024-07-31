<script setup lang="ts">
// @ts-nocheck
import { watch } from 'vue';

const { foo, bar, ...props } = defineProps<{
    foo: string;
    bar: string;
}>();

type foo = foo & typeof foo;

interface foo {
    foo: typeof foo;
}

const obj = {
    foo: foo,
    foo
}

class cls {
    foo: string = foo;
    constructor(foo) {}
}

function fn1 (foo) {}
const fn2 = function(foo) {}

watch(() => foo, (foo) => {
    console.log(foo, bar, props);
});
</script>

<template>
    {{ foo }}
</template>