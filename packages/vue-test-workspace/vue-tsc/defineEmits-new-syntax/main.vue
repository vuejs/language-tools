<script setup lang="ts">
import { exactType } from '../shared';
import Comp from './Comp.vue';
</script>

<template>
	<Comp @foo="(x) => exactType(x, {} as string)" />
</template>
