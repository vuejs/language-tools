<script setup lang="ts" generic="T">
import type { Ref } from 'vue';

const props = defineProps<{ value: T }>();
const value: T = props.value;
function accept(_value: T extends Ref<unknown> & { value: infer V } ? V : T) {}
</script>

<template>
	{{ accept(value) }}
</template>
