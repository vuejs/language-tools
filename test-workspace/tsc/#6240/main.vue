<script setup lang="ts">
import Child from './child.vue';

const ids = [1, 2];
</script>

<template>
	<template v-for="id in ids">
		<Child :foo="`https://example.com/${id}`" />
		{{ id }}
	</template>
</template>
