<script setup lang="ts">
import { exactType } from '../shared';
import child from './child.vue';
</script>

<template>
	<child bar="..." @foo="e => exactType(e, {} as string)" />
</template>
