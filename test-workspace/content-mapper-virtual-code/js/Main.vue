<script setup>
import { ref } from 'vue';
import { exactType } from '../../tsc/shared';
import Comp from './Comp.vue';

/** @type {import('vue').FunctionalComponent<{ msg: string }>} */
const Fn = () => null;
/** @type {new <T>(props: { value: T }) => { $props: { value: T }; $emit: (event: 'change', value: T) => void }} */
const Gen = /** @type {any} */ (null);
/** @type {new () => { $props: { label?: string } }} */
const NoArgs = /** @type {any} */ (null);
/** @type {{}} */
const Untyped = {};

const notComp = 1;
const text = ref('');
const count = ref(0);
</script>

<template>
	<Comp a="x" @foo="exactType($event, undefined); count++" @bar="exactType($event, /** @type {number} */ (0))" />
	<Comp v-model:a="text" @ping="exactType($event, /** @type {any} */ (null))" />
	<Untyped v-model:b="text" @custom="exactType($event, /** @type {any} */ (null))" />
	<Fn msg="hi" />
	<Gen :value="1" @change="exactType($event, /** @type {number} */ (0))" />
	<NoArgs label="x" />
	<notComp />
	<!-- @vue-expect-error -->
	<Missing />
	<!-- @vue-expect-error -->
	<missing-comp></missing-comp>
	<Transition></Transition>
	<div @custom-event="exactType($event, /** @type {any} */ (null))" />

	<!-- @vue-expect-error -->
	<Gen :value="1" @change="exactType($event, /** @type {string} */ (''))" />
	<!-- @vue-expect-error -->
	<Comp @foo="exactType($event, /** @type {number} */ (0))" />
	<!-- @vue-expect-error -->
	<NoArgs :label="1" />
</template>
