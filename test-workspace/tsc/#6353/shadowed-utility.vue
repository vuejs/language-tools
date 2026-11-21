<script setup lang="ts">
import Child from './child.vue';

type Exclude = 'internal';

defineProps<{
	panelId: string;
	mode?: Exclude;
}>();
</script>

<template>
	<component :is="Child" />
</template>
