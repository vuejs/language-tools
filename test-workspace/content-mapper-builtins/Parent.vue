<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import Child from './Child.vue';
import GenericChild from './GenericChild.vue';
import InferredChild from './InferredChild.vue';
import Refs from './Refs.vue';

const text = ref<string>();
const picked = ref<number>();
const child = useTemplateRef('child');

function onChange(value: number) {
	text.value = String(value);
}
</script>

<template>
	<Child v-model="text" :count="1" class="child" @change="onChange">
		<template #default="{ item }">{{ item }}</template>
		<template #footer>footer</template>
	</Child>
	<GenericChild ref="child" v-model:selected="picked" :items="[1, 2]" @select="onChange">
		<template #default="{ item }">{{ item }}</template>
	</GenericChild>
	<InferredChild id="inferred" title="title" @close="text = ''">
		<template #head="{ title }">{{ title }}</template>
		body
	</InferredChild>
	<Refs />
	{{ child }}
</template>
