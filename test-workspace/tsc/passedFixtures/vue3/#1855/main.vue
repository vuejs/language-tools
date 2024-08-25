<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';
</script>

<template>
	<Child @event-str="s => exactType(s, '' as string)" @event-any="a => exactType(a, {} as any)" />
</template>
