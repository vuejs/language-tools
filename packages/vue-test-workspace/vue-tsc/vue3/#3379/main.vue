<script lang="ts" setup>
import { exactType } from '../../shared';
import Child from './child.vue';
</script>

<template>
	<Child @update:modelValue="s => exactType(s, '' as string)"></Child>
</template>
