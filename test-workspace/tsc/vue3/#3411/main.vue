<script lang="ts">
import { defineComponent } from 'vue';
import Comp from './Comp.vue';
import { exactType } from '../../shared';

export default defineComponent({
	components: {
		Comp,
	},
	computed: {
		Comp() {
			return 123;
		},
	},
	methods: {
		exactType,
	},
});
</script>

<template>
	<Comp @foo="e => exactType(e, 1 as number)" />
	{{ exactType(Comp, 123) }}
</template>
