<template>{{ foo }}</template>

<script lang="ts" setup>
ref: ({ foo } = { foo: '' });
foo;
</script>