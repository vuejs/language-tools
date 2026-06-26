<script setup lang="ts">
interface Props {
	onClick?: (num: number) => number;
}

declare function Comp(props: Props): void;

type Foo = NonNullable<Props['onClick']>;
declare const foo: unknown;
</script>

<template>
	<Comp @click="(<Foo>foo! as Foo)" />
	<Comp @click="({} as Props).onClick" />
</template>
