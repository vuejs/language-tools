<script setup lang="ts">
import { exactType } from '../../shared';

const foo = true ? 2 : [1];
</script>

<template>
	<div v-for="f in foo" :key="f">{{ exactType(f, 1 as number) }}</div>
</template>
