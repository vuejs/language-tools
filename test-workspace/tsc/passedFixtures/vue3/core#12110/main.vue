<script setup lang="ts">
import Comp from './comp.vue';
import { exactType } from '../../shared';
</script>

<template>
	<Comp foo="..." @click="(e) => exactType(e, {} as number)" />
	<Comp bar="..." @click="(e) => exactType(e, {} as number)" />
</template>
