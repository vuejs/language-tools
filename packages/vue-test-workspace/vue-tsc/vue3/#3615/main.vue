<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';
</script>

<template>
	<Child
		model-value="1"
		@update:model-value="(e) => exactType(e, '' as string)"
	/>
</template>
