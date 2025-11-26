<script setup lang="ts">
import { defineComponent } from 'vue';
const Comp = defineComponent({})
const cond1: true | 'text' = Math.random() > 0.5 ? true : 'text'
const cond2 = true
</script>

<template>
	<Comp>
		<template #default v-if="cond1">1</template>
		<template #default v-else-if="cond2">2</template>

		<div v-if="cond1 === true"></div>
		<div v-else-if="cond1.length"></div>

		<template #default v-if="cond1 === true">1</template>
		<template #default v-else-if="cond1.length">2</template>
	</Comp>
</template>
