<script setup lang="ts">
interface Props {
	onClick?: () => number;
}

declare function Comp(props: Props): void;

type Foo = NonNullable<Props['onClick']>;
declare const foo: unknown;
</script>

<template>
	<Comp @click="(<Foo>foo! as Foo)" />
	<Comp @click="({} as Props).onClick" />
	<!-- @vue-expect-error -->
	<Comp @click="(() => 1);" />
	<template v-if="true">
		<Comp @click="(() => 1)()" />
	</template>
</template>
