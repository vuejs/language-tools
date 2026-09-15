<script setup lang="ts">
import Basic from './Basic.vue';
import Recursive from './Recursive.vue';
import { defineAsyncComponent } from 'vue';
import Required from './Required.vue';
import InputList from './InputList.vue';
import RequiredNamed from './RequiredNamed.vue';
import Optional from './Optional.vue';
import OptionalItem from './OptionalItem.vue';
import Item from './Item.vue';
import Other from './Other.vue';
import Parent from './Parent.vue';
import PairWrapper from './PairWrapper.vue';
import ConditionalWrapper from './ConditionalWrapper.vue';
import Container from './Container.vue';
import Forwarder from './Forwarder.vue';
import UnknownForwarder from './UnknownForwarder.vue';
import * as Components from './barrel';
defineProps<{
	ok: boolean;
	values: number[];
	name: 'input' | 'inputs';
	broadName: 'input' | 'nodes';
	choice: typeof Item<number>;
	slotParent: typeof Required | typeof InputList;
}>();
const payload = { value: 1 };
const AsyncPair = defineAsyncComponent(() => import('./PairWrapper.vue'));
</script>
<template>
	<Optional />
	<Required>
		<input />
	</Required>
	<RequiredNamed>
		<input />
		<template #header>
			<button />
		</template>
	</RequiredNamed>
	<!-- @vue-expect-error -->
	<RequiredNamed>
		<template #header>
			<button />
		</template>
	</RequiredNamed>
	<!-- @vue-expect-error -->
	<RequiredNamed>
		<input />
	</RequiredNamed>
	<!-- @vue-expect-error -->
	<RequiredNamed>
		<input />
		<template v-if="ok" #header>
			<button />
		</template>
	</RequiredNamed>
	<!-- @vue-expect-error -->
	<Required />
	<Optional>
		<!-- @vue-expect-error -->
		<template #default />
	</Optional>
	<Basic>
		<PairWrapper />
		<AsyncPair />
	</Basic>
	<!-- @vue-expect-error -->
	<Basic>
		<Recursive :depth="3" />
	</Basic>
	<Basic>
		<ConditionalWrapper :ok="ok" />
	</Basic>
	<Basic>
		<Components.Item :value="1" />
	</Basic>
	<Basic>
		<component :is="choice" :value="1" />
	</Basic>
	<Basic>
		<Item v-bind="payload" />
	</Basic>
	<!-- @vue-generic {number} -->
	<Parent :value="1">
		<Item :value="1" />
	</Parent>
	<!-- @vue-expect-error -->
	<Basic>
		<Container />
	</Basic>
	<!-- @vue-expect-error -->
	<Basic>
		<div>
			<Item :value="1" />
		</div>
	</Basic>
	<!-- @vue-expect-error -->
	<Basic>
		<Item v-for="value in ['wrong']" :value="value" />
	</Basic>
	<!-- @vue-expect-error -->
	<Basic>
		<Item v-if="ok" :value="1" />
		<input v-else />
	</Basic>
	<Basic>
		<template #pair>
			<PairWrapper />
		</template>
		<template #input>
			<Forwarder>
				<input />
			</Forwarder>
		</template>
		<template #inputs>
			<input v-for="n in values" :value="n" />
		</template>
		<template #variadic>
			<input />
			<button v-for="n in values" :value="n" />
			<input />
		</template>
		<template #positioned>
			<Other other="first" />
			<Other other="second" />
		</template>
		<template #positionedUnion>
			<Other other="first" />
			<Other other="second" />
		</template>
		<template #mixed>
			<input />
			<Item :value="1" />
		</template>
		<template #scoped="{ value }">
			<Item :value="value" />
		</template>
		<template #nodes>
			<input />
			text
			<Item :value="1" />
		</template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #single>
			<PairWrapper />
		</template>
		<!-- @vue-expect-error -->
		<template #input>
			<UnknownForwarder>
				<button />
			</UnknownForwarder>
		</template>
		<!-- @vue-expect-error -->
		<template #pair>
			<ConditionalWrapper :ok="ok" />
		</template>
		<!-- @vue-expect-error -->
		<template #tuple>
			<button />
			<input />
		</template>
		<!-- @vue-expect-error -->
		<template #inputs>
			<input />
			text
		</template>
		<!-- @vue-expect-error -->
		<template #variadic>
			<button />
			<input v-for="n in values" :value="n" />
			<input />
		</template>
		<!-- @vue-expect-error -->
		<template #positioned>
			<Other other="first" />
			<input />
		</template>
		<!-- @vue-expect-error -->
		<template #positionedUnion>
			<Other other="first" />
			<Other v-if="ok" other="second" />
			<input v-else />
		</template>
		<!-- @vue-expect-error -->
		<template #input />
		<!-- @vue-expect-error -->
		<template #never />
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #single>
			<Item v-if="ok" :value="1" />
		</template>
		<!-- @vue-expect-error -->
		<template #input>
			<input v-for="n in values" :value="n" />
		</template>
	</Basic>
	<Parent :value="1">
		<!-- @vue-expect-error -->
		<template #props>
			<OptionalItem />
		</template>
	</Parent>
	<Basic>
		<template #[name]>
			<input />
		</template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #[name]>
			<input />
			<input />
		</template>
	</Basic>
	<Basic>
		<template #[broadName]>
			<input />
		</template>
	</Basic>
	<Basic>
		<!-- @vue-expect-error -->
		<template #[broadName]>
			<button />
		</template>
	</Basic>
	<Basic>
		<template v-if="name === 'inputs'" #[name]>
			<input />
			<input />
		</template>
		<template v-else #[name]>
			<input />
		</template>
	</Basic>
	<component :is="slotParent">
		<input />
	</component>
	<!-- @vue-expect-error -->
	<component :is="slotParent">
		<input />
		<input />
	</component>
</template>
