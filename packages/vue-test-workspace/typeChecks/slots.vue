<template>
	<!-- $slots type -->
	<Comp value="1">
		<template #foo="bindings">{{ exactType(bindings, {} as string) }}</template>
	</Comp>
	<Comp :value="1">
		<template #foo="bindings">{{ exactType(bindings, {} as number) }}</template>
	</Comp>

	<!-- template slots type -->
	<slot name="bar" str="str" :num="1"></slot>
	<Self>
		<template #bar="{ str, num }">
			<!-- not support for now -->
			<!-- {{ exactType(str, {} as string) }} -->
			<!-- {{ exactType(num, {} as number) }} -->
			{{ exactType(str, {} as any) }}
			{{ exactType(num, {} as any) }}
		</template>
	</Self>
</template>

<script lang="ts">
export default { name: 'Self' };

declare const Comp: new <T>(props: { value: T; }) => {
	$props: typeof props;
	$slots: {
		foo: (_: T) => VNode[];
	},
};
</script>

<script lang="ts" setup>
import { VNode } from 'vue';
import { exactType } from './shared';
</script>
