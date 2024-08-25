<script lang="ts" setup>
import Comp from './comp.vue';

let value!: number | undefined;
if (!value) {
	throw new Error('undefined');
}
</script>

<template>
	<Comp :foo="value"></Comp>
</template>
