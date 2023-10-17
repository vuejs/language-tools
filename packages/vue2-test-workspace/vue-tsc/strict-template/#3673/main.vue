<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue'
</script>

<template>
	<Comp @click="s => exactType(s, '' as string)"></Comp>
</template>