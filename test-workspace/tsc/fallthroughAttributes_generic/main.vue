<script setup lang="ts">
import { exactType } from '../shared';
import basic from './basic.vue';
</script>

<template>
	<basic bar="..." @foo="e => exactType(e, {} as string)" />
</template>
