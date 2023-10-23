<script setup lang="ts">
import child from './child.vue';
import { exactType } from '../../shared';
import { ref } from 'vue';

const input = ref(3);
const select = ref('asdf');
</script>

<template>
	<child type="select" :typeDefinition="select" :value="k => exactType(k, {} as string[])"></child>
	<child type="input" :typeDefinition="input" :value="k => exactType(k, {} as number)"></child>
</template>
