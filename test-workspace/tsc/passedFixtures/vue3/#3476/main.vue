<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';
</script>

<template>
	<Child @my-event="v => exactType(v, 1 as number)" />
</template>
