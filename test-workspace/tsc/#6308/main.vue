<script setup lang="ts">
import { ref } from 'vue';
import Declared from './Declared.vue';
import DeclaredNamed from './DeclaredNamed.vue';
import TextField from './TextField.vue';

declare const Named: new () => {
	$props: { title?: unknown };
	$emit: (event: 'update:title', value: string) => void;
};
declare const Labeled: new () => {
	$props: { label?: string; modelValue?: string };
};

const num = ref(0);
const str = ref('');
</script>

<template>
	<!-- Vue passes the modifiers through the vnode props whether or not the component declares them -->
	<TextField v-model.trim="str" />
	<TextField v-model.lazy.trim="str" />
	<Named v-model:title.trim="str" />

	<!-- the modifiers that a component declares are still checked -->
	<Declared v-model.foo="str" />
	<!-- @vue-expect-error -->
	<Declared v-model.unknown="str" />
	<DeclaredNamed v-model:title.bar="str" />
	<!-- @vue-expect-error -->
	<DeclaredNamed v-model:title.unknown="str" />

	<!-- the other props of the element are still checked -->
	<!-- @vue-expect-error -->
	<Labeled v-model.trim="str" :label="num" />
	<!-- @vue-expect-error -->
	<Declared v-model.foo="num" />
</template>
