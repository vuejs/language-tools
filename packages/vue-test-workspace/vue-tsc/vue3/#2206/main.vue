<template>
	<A :foo="v => exactType(v, {} as string)"></A>
	<B :foo="v => exactType(v, {} as string)"></B>
	<C :foo="v => exactType(v, {} as string)"></C>
	<D :foo="v => exactType(v, {} as string)"></D>
</template>

<script lang="ts">
import { exactType } from '../../shared';

declare const A: (props: { foo: (_: string) => void; }) => void;
declare const B: (props: { foo: (_: string) => void; }, _1: {}) => void;
declare const C: (props: { foo: (_: string) => void; }, _1: {}, _2: {}) => void;
declare const D: (props: { foo: (_: string) => void; }) => { props: {} };
</script>

<script lang="ts" setup>
</script>
