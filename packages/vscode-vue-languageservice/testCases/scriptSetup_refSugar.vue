<template>{{ foo }}</template>

<script lang="ts" setup>
ref: ({ foo } = useFoo());
function useFoo() {
    return { foo: '' };
}
foo;
</script>