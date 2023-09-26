<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue';
</script>

<template>
	<Comp @my-event="v => exactType(v, 1 as number)" />
</template>
