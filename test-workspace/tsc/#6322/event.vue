<script setup lang="ts">
import { exactType } from '../shared';
import Child from './child.vue';
</script>

<template>
	<!-- contextual type of the handler parameter -->
	<Child url="https://example.com" @done="value => exactType(value, {} as number)" />
</template>
