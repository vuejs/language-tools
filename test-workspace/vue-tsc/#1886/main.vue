<script setup lang="ts">
import { exactType } from '../shared';

declare module 'vue' {
	export interface GlobalComponents {
		Foo: any;
	}
}

declare const Foo: new () => {
	$slots: {
		foo: (props: { bar: string; }) => any;
	};
};
</script>

<template>
	<Foo>
		<template #foo="{ bar }">
			{{ exactType(bar, {} as string) }}
		</template>
	</Foo>
</template>
