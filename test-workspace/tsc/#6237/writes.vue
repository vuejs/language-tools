<script setup lang="ts">
let flag: boolean = Math.random() > 0.5;
let mode: 'a' | 'b' = Math.random() > 0.5 ? 'a' : 'b';
let nullable: number | null = Math.random() > 0.5 ? 1 : null;
</script>

<template>
	<button @click="() => { if (flag) flag = false; }" />
	<button v-if="flag" @click="flag = false" />
	<button @click="() => { if (mode === 'a') mode = 'b'; }" />
	<button @click="() => { if (nullable !== null) nullable = null; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { flag = 'wrong'; }" />
</template>
