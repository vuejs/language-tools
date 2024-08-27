<script setup lang="ts">
import basic from './basic.vue';
import { exactType } from '../../shared';
</script>

<template>
	<basic @change="v => exactType(v, {} as number)" />
</template>
