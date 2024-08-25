<template>
	<div>
		<div v-for="(row, index) in rows">
			<span>Row #{{ index }}</span>
			<slot :row="row" />
		</div>
	</div>
</template>

<script setup lang="ts" generic="Row extends BaseRow">
export type BaseRow = { value: string; };

defineProps<{
	nonGeneric: string;
	rows: Row[];
}>();
</script>
