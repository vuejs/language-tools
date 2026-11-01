<!-- @vModelPropName { "my-input": false, "textarea": false } -->

<script setup lang="ts">
declare const Textarea: new () => { $props: { modelValue?: number } };

declare const bool: boolean;
declare const str: string;
</script>

<template>
	<!-- the root comment overrides the project -->
	<my-input v-model="bool" />
	<!-- and keeps its other entries -->
	<!-- @vue-expect-error `checked` is a boolean -->
	<my-switch v-model="str" />

	<textarea v-model="bool"></textarea>
	<!-- an entry of a native tag does not apply to a component of the same name -->
	<!-- @vue-expect-error `modelValue` is a number -->
	<Textarea v-model="str" />
</template>
