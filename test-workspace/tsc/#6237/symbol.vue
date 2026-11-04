<script setup lang="ts">
const key = Symbol();
function accept(_key: typeof key) {}
</script>

<template>
	{{ accept(key) }}
</template>
