<script setup lang="ts">
import EndInsert, { tail } from './EndInsert.vue';
import SlotsAlias from './SlotsAlias.vue';
import WrapDefault from './WrapDefault.vue';

const one: 1 = tail;
</script>

<template>
	<EndInsert />
	<WrapDefault :wrapped="1" />
	<WrapDefault :wrapped="'wrong'" />
	<WrapDefault own="a" />
	<SlotsAlias>
		<template #extra="{ n }">{{ n.toFixed() }}</template>
	</SlotsAlias>
	<SlotsAlias>
		<template #extra="{ n }">{{ n.nope }}</template>
	</SlotsAlias>
</template>
