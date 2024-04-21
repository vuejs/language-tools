<script setup lang="ts">
import { exactType } from '../../shared';

let Foo: new () => { $props: { foo: (_: string) => void; }; };
let Bar: new () => { $props: { bar: (_: number) => void; }; };
</script>

<template>
	<!-- <component is="a" @click="e => exactType(e, {} as MouseEvent)" /> -->
	<component :is="Foo" :foo="e => exactType(e, {} as string)" />
	<!-- <component is="Foo" :foo="e => exactType(e, {} as string)" /> -->
	<component :is="Math.random() > 0.5 ? Foo : Bar" :foo="e => exactType(e, {} as string)" />
	<component :is="Math.random() > 0.5 ? Foo : Bar" :bar="e => exactType(e, {} as number)" />
</template>
