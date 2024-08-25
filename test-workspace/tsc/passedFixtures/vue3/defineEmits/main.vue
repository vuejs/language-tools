<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';
</script>

<template>
	<Child @foo="(x) => exactType(x, {} as string)" />
</template>
