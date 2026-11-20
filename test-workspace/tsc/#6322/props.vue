<script setup lang="ts">
import Child from './child.vue';

declare const Required: new(props: { id: string; count?: number }) => { $props: { id: string; count?: number } };
declare const Generic: new<T extends string>(props: { value: T }) => { $props: { value: T } };

function log(_value: number) {}
</script>

<template>
	<!-- a prop after the value is still checked -->
	<!-- @vue-expect-error -->
	<Child url="https://example.com" :count="'not a number'" />

	<!-- a directive comment in a prop does not hide the missing prop of the component -->
	<!-- @vue-expect-error -->
	<Required
		:count="
			// @ts-ignore
			1
		"
	/>

	<!-- a directive comment in a prop applies to its next line -->
	<Child
		:count="
			// @ts-expect-error
			log('not a number') ?? 1
		"
	/>

	<!-- statements separated by line breaks only, with blank and comment lines -->
	<Child
		:format="value => {

			// a comment
			log(value)
			return String(value)
		}"
	/>

	<!-- a function on a later line of a prop -->
	<Child
		:options="{
			onClose: event => event.preventDefault(),
		}"
	/>

	<!-- a function after a line break in a template literal -->
	<Child
		:options="{
			title: `a
b`, onClose: event => event.preventDefault(),
		}"
	/>

	<!-- a function after a line break in a block comment -->
	<Child
		:format="/* a comment
*/ value => String(value)"
	/>

	<!-- statements separated by the line break in a block comment only -->
	<Child
		:format="value => {
			log(value) /*
			*/ return String(value)
		}"
	/>

	<!-- line breaks in a template literal and in a string -->
	<Generic
		:value="`a
b`"
	/>
	<Generic
		:value="'a\
b'"
	/>
	<Generic
		:value="`$\
{}`"
	/>
</template>
