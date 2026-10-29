<script setup lang="ts">
import { computed, type MaybeRef } from 'vue';

declare function getValue(): MaybeRef<string | undefined>;
const maybe = getValue();
const readonlyValue = computed(() => 'value');
</script>

<template>
	<div>
		<!-- @vue-expect-error -->
		{{ maybe.toUpperCase() }}
	</div>
	<div v-if="maybe">
		<!-- @vue-expect-error -->
		{{ maybe.doesNotExist }}
	</div>
	<div v-if="readonlyValue">
		<!-- @vue-expect-error -->
		<button @click="readonlyValue = 'changed'" />
	</div>
</template>
