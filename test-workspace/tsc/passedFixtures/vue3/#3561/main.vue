<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';

const componentState = {
	selected: '',
	items: [null],
};
</script>

<template>
	<Child
		v-slot="{ item }"
		v-model="componentState.selected"
		:items="componentState.items"
		:get-key="(item) => {
			exactType(item, null);
			return '';
		}"
	>
		{{ exactType(item, null) }}
	</Child>
</template>
