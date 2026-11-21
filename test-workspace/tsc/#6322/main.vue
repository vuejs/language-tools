<script setup lang="ts">
import { reactive } from 'vue';
import { exactType } from '../shared';
import Child from './child.vue';

const state = reactive({ text: '' });
const ids = [1];
</script>

<template>
	<!-- dot value narrowing, the scope of `v-for` and the contextual type of a handler parameter -->
	<template v-for="id in ids" :key="id">
		<Child v-model="state.text" url="http://127.0.0.1:7890" @done="value => exactType(value, {} as number)" />
		<Child v-model="state.text" url='http://127.0.0.1:7890/"' />
		<Child v-model="state.text" :url="`http://127.0.0.1:${`//${id}`}//`" />
		<Child v-model="state.text" :url="/:[//]+/" />
		<Child v-model="state.text" :url="`${'a/b'.replace(/\//g, '-')}`" />
		<Child v-model="state.text" :url="'//' + id / 2 + /* // */ '//'" />
		<Child
			v-model="state.text"
			:url="
				// a comment with `//` and */ and 'quotes
				'http://127.0.0.1:7890' // another one
			"
		>
			{{ exactType(state.text, {} as string) }}
			{{ exactType(id, {} as number) }}
		</Child>
	</template>
</template>
