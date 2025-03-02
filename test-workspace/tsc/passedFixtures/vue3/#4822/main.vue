<script lang="ts">
import { defineComponent } from 'vue';
import { exactType } from '../../shared';
import Comp from './comp.vue';

export default defineComponent({
	components: {
		Comp
	}
});
</script>

<script setup lang="ts">
let foo!: number;
</script>

<template>
	<Comp @foo="(arg) => exactType(arg, {} as number)" v-model="foo"></Comp>
</template>
