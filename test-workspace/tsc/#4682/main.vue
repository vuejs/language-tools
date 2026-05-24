<template>
	<div v-object1="[1, (_a: 1) => { }]"></div>
	<div v-object2="[1, (_a: 1) => { }]"></div>
	<div v-function1="[1, (_a: 1) => { }]"></div>
	<div v-function2="[1, (_a: 1) => { }]"></div>
</template>

<script lang="ts" setup>
import { FunctionDirective } from 'vue';
import { ObjectDirective } from 'vue';

const vObject1 = {
	created<T extends number>(
		_el: HTMLElement,
		_binding: { value: [T, (a: T) => void]; }
	) { },
	mounted<T extends number>(
		_el: HTMLElement,
		_binding: { value: [T, (a: T) => void]; },
		_vNode: any,
	) { },
};
const vObject2 = {} as any as ObjectDirective<any, [1, (a: 1) => void]>;
function vFunction1<T extends number>(_el: any, _binding: { value: [T, (a: T) => void]; }) { }
const vFunction2 = {} as any as FunctionDirective<any, [1, (a: 1) => void]>;
</script>
