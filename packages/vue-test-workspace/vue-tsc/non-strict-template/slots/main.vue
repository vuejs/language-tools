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
			{{ exactType(str, {} as string) }}
			{{ exactType(num, {} as number) }}
		</template>
	</Self>
	
	<!-- typed slot key -->
	<slot :name="baz" str="str" :num="1"></slot>
	<Self>
		<template #baz="{ str, num }">
			{{ exactType(str, {} as string) }}
			{{ exactType(num, {} as number) }}
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
import { ref, VNode } from 'vue';
import { exactType } from '../../shared';

const baz = ref('baz' as const);
</script>
