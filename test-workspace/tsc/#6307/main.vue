<script setup lang="ts">
import { exactType } from '../shared';
import child from './child.vue';
</script>

<template>
	<child :value="1" @select="v => exactType(v, {} as number)" />
</template>
