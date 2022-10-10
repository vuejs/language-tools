<script setup lang="ts">
const ifVar = {} as boolean;
const elseIfVar = {} as boolean;
const ifExp = 1;
const ifElseExp = 1;
const elseExp = 1;
</script>

<template>
	<div v-if="ifVar">{{ ifExp }}</div>
	<div v-else-if="elseIfVar">{{ ifElseExp }}</div>
	<div v-else>{{ elseExp }}</div>
</template>
