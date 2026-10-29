<script setup lang="ts">
import { ref } from 'vue';

const Comp = (_props: { foo: string }) => {};
const Wrapper = (_props: {}) => {};
const flag = ref(true);
declare const bad: symbol;
</script>

<template>
	<!-- the props object of the component itself is ignored -->
	<!-- @vue-ignore -->
	<Comp />

	<!-- children are outside the scope of their parent's directive -->
	<!-- @vue-ignore -->
	<div :id="bad">
		<Comp />
		{{ notExist }}
	</div>

	<!-- @vue-ignore -->
	<Wrapper>
		<Comp />
		<template #default>
			<!-- @vue-ignore -->
			<Comp />
		</template>
	</Wrapper>

	<!-- @vue-ignore -->
	<div v-if="flag" :id="bad">
		<Comp />
	</div>
	<!-- @vue-ignore -->
	<div v-else-if="flag.value.missing" :id="bad"></div>
	<div v-else :id="bad"></div>

	<!-- @vue-ignore -->
	<div v-for="_ in 2" :id="bad">
		<Comp />
	</div>

	<!-- @vue-ignore -->
	<!-- @vue-expect-error -->
	<Comp />

	<Comp />
</template>
