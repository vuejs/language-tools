<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue';
</script>

<template>
	<Comp @event-str="s => exactType(s, '' as string)" @event-any="a => exactType(a, {} as any)" />
</template>
