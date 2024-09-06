<script lang="ts">
type Foo = {
	a: string;
	b: number;
};

declare function func<TFoo extends Foo>(foo: TFoo, fooKey: keyof TFoo): any;
</script>

<script setup lang="ts" generic="TFoo extends Foo, TFooKey extends keyof TFoo">
const { foo, fooKey, ...props } = defineProps<{
	foo: TFoo;
	fooKey: TFooKey;
	bar: TFoo;
	barKey: TFooKey;
}>();
</script>

<template>
	{{ func(foo, fooKey) }}
	{{ func(props.bar, props.barKey) }}
</template>
