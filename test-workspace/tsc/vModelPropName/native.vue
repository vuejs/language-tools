<script setup lang="ts">
declare const bool: boolean;
declare const num: number;
declare const list: string[];
declare const type: 'checkbox' | 'radio';
declare const attrs: Record<string, unknown>;
</script>

<template>
	<!-- @vue-expect-error `value` of a textarea is not a boolean -->
	<textarea v-model="bool"></textarea>
	<select v-model="list" multiple></select>
	<input v-model="num" />
	<input v-model="num" type="number" />
	<input v-model="list" type="checkbox" value="a" />
	<input v-model="num" type="radio" :value="1" />
	<input v-model="num" :type="type" :value="1" />
	<input v-model="num" v-bind="attrs" />
</template>
