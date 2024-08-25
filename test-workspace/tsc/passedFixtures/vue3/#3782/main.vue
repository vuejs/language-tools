<script setup lang="ts">
import { defineComponent } from 'vue';

export const Test = defineComponent(
	<TStr extends "one" | "two", TNum extends TStr extends "one" ? 1 : 2>(props: {
		str: TStr;
		num: TNum;
		numFn: (num: TNum) => TNum;
	}) => {
		return () => props.str;
	}
);
</script>

<template>
	<!-- val is `1` -->
	<Test str="one" :num="1" :numFn="val => val" />
	<!-- val is `2` -->
	<Test str="two" :num="2" :numFn="val => val" />
</template>
