<script setup lang="ts">
import { useCssModule, useTemplateRef } from 'vue';

const input = useTemplateRef<HTMLInputElement>('input');
const inputClass = useCssModule().box;
const color = 'red';

function focus() {
	input.value?.focus();
}
</script>

<template>
	<div :class="$style.box" class="root">
		<input ref="input" :class="inputClass" @focus="focus" />
		{{ $refs.input }} {{ $el }}
	</div>
</template>

<style module>
.box {
	color: v-bind(color);
}
</style>

<style scoped>
.root {
	display: block;
}
</style>
