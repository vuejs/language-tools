<script setup lang="ts">
import child from './child.vue';
import { exactType } from '../shared';
</script>

<template>
	<child @change="v => exactType(v, {} as number)" />
</template>
