<script setup lang="ts">
import ImportedGeneric from './ImportedGeneric.vue';
import Item from './Item.vue';
import type { ModelAlias } from './model';
const model: ModelAlias = { id: 1, label: 'one' };
</script>
<template>
	<ImportedGeneric :item="model">
		<Item :value="model" />
	</ImportedGeneric>
	<!-- @vue-generic {ModelAlias} -->
	<ImportedGeneric :item="model">
		<Item :value="model" />
	</ImportedGeneric>
	<!-- @vue-expect-error -->
	<ImportedGeneric :item="model">
		<Item :value="{ id: 1 }" />
	</ImportedGeneric>
	<!-- @vue-expect-error -->
	<ImportedGeneric :item="model">
		<Item :value="{ id: 'wrong', label: 'one' }" />
	</ImportedGeneric>
</template>
