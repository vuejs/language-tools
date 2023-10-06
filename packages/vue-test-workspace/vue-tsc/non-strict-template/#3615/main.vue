<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue';
</script>

<template>
	<Comp
		model-value="1"
		@update:model-value="(e) => exactType(e, '' as string)"
	/>
</template>
