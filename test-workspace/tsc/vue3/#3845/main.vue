<script setup lang="ts">
import { exactType } from '../../shared';

declare const list1: number | number[];
declare const list2: string | number[];
declare const list3: string | number;
declare const list4: string | number | { [Symbol.iterator](): Iterator<any> };
declare const list5: string | number | Set<string>;
</script>

<template>
	<div v-for="f in list1" :key="f">{{ exactType(f, 1 as number) }}</div>
	<div v-for="f in list2" :key="f">{{ exactType(f, 1 as string | number) }}</div>
	<div v-for="f in list3" :key="f">{{ exactType(f, 1 as string | number) }}</div>
	<div v-for="f in list4" :key="f">{{ exactType(f, 1 as any) }}</div>
	<div v-for="f in list5" :key="f">{{ exactType(f, 1 as string | number | string) }}</div>
</template>
