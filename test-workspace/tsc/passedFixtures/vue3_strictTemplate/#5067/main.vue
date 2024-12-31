<script setup lang="ts">
import { exactType } from '../../shared';
import {
	default as isComp1,
	default as IsComp2
} from './comp.vue';

const isComp3 = isComp1;
const IsComp4 = isComp3;
</script>

<template>
	<is-comp1 foo="" @foo="v => exactType(v, {} as string)" />
	<isComp1 foo="" @foo="v => exactType(v, {} as string)" />
	<!-- @vue-expect-error -->
	<IsComp1 />

	<is-comp2 foo="" @foo="v => exactType(v, {} as string)" />
	<isComp2 foo="" @foo="v => exactType(v, {} as string)" />
	<IsComp2 foo="" @foo="v => exactType(v, {} as string)" />

	<is-comp3 foo="" @foo="v => exactType(v, {} as string)" />
	<isComp3 foo="" @foo="v => exactType(v, {} as string)" />
	<!-- @vue-expect-error -->
	<IsComp3 />

	<is-comp4 foo="" @foo="v => exactType(v, {} as string)" />
	<isComp4 foo="" @foo="v => exactType(v, {} as string)" />
	<IsComp4 foo="" @foo="v => exactType(v, {} as string)" /> 
</template>
