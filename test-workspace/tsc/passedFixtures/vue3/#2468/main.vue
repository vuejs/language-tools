<script setup lang="ts">
let Foo: new () => {
	$props: {
		onFoo: () => void;
	};
};
let Bar: (props: { foo: string }) => {};
</script>

<template>
	<Foo @foo="() => { }"></Foo>
	<Bar @bar="() => { }" foo="foo"></Bar>
</template>
