<script setup lang="ts">
import { reactive } from 'vue';
import { exactType } from '../shared';
import Child from './child.vue';

const state = reactive({ text: '' });
const id = 1;
const optional = 1 as number | undefined;
</script>

<template>
	<!-- dot value narrowing -->
	<Child v-model="state.text" url="http://127.0.0.1:7890" />
	<Child v-model="state.text" url='http://127.0.0.1:7890/"' />
	<Child v-model="state.text" :url="`http://127.0.0.1:${`//${id}`}//`" />
	<Child v-model="state.text" :url="/:[//]+/.source" />
	<Child v-model="state.text" :url="/:[//]+/" />
	<Child v-model="state.text" :url="'//' + id / 2 + /* // */ '//'" />
	<Child
		v-model="state.text"
		:url="
			'//' + optional! / 2 // a division after a non-null assertion, not a regular expression: 1/2
		"
	/>
	<Child
		v-model="state.text"
		:url="
			// a comment with `//` and */ and 'quotes
			'http://127.0.0.1:7890' // another one
		"
	>
		{{ exactType(state.text, {} as string) }}
	</Child>
</template>
