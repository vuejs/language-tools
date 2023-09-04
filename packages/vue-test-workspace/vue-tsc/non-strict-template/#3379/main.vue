<script lang="ts" setup>
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue';
</script>

<template>
	<Comp @update:modelValue="s => exactType(s, '' as string)"></Comp>
</template>
