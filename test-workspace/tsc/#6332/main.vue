<script setup lang="ts" generic="T">
import Child from './child.vue';

defineProps<{ items: { key: string; label: string; value: T }[] }>();
</script>

<template>
	<Child :items="items" :class="$style.wrapper">
		<template #default="{ item }">
			<slot :name="`header:${item.key}`">{{ item.label }}</slot>
		</template>
	</Child>
</template>

<style module>
.wrapper {
	display: block;
}
</style>
