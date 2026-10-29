<script setup lang="ts" generic="T extends { slot?: string }">
type Slots<T extends { slot?: string }> = {
	item?: (props: { item: T; index: number }) => any;
} & {
	[K in T['slot'] & string]?: (props: { item: T; index: number }) => any;
};

defineProps<{ items: T[] }>();
defineSlots<Slots<T>>();
</script>

<template>
	<div v-for="(item, index) in items">
		<slot :name="(item.slot || 'item') as keyof Slots<T>" :item="item" :index="index" />
	</div>
</template>
