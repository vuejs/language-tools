<script lang="ts">
import { defineComponent, ref } from 'vue';

export default defineComponent({
	setup() {
		const setup1 = ref('setup1');
		const setup2 = ref('setup2');
		return { setup1, setup2 };
	},
	data() {
		return {
			data1: 1,
		};
	},
	props: {
		props1: {
			type: String,
		},
	},
	computed: {
		computed1() {
			return this.setup1.toUpperCase();
		},
	},
	methods: {
		methods1() {
			return `methods1`;
		},
	},
	expose: ['setup1'],
});
</script>

<template>
	<div @click="methods1()">
		{{ setup1 }}
		{{ setup2 }}
		{{ data1 }}
		{{ props1 }}
		{{ computed1 }}
	</div>
</template>
