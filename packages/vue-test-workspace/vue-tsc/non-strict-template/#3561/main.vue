<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue';

const componentState = {
	selected: '',
	items: [null],
};
</script>

<template>
	<Comp
		v-slot="{ item }"
		v-model="componentState.selected"
		:items="componentState.items"
		:get-key="(item) => {
			exactType(item, null);
			return '';
		}"
	>
		{{ exactType(item, null) }}
	</Comp>
</template>
