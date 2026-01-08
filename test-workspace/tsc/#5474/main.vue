<script setup lang="ts">
import { exactType } from '../shared';

type Foo = { foo: string };
type Bar = { bar: string };

declare const Comp: (props: {}, ctx: {
	slots: {
		foo: (props: Foo) => void;
		bar: (props: Bar) => void;
	}
}) => {};
</script>

<template>
	<Comp>
		<template v-for="name in (['foo', 'bar'] as const)" #[name]="props">
			{{ exactType(props, {} as Foo | Bar) }}
		</template>
	</Comp>
</template>
