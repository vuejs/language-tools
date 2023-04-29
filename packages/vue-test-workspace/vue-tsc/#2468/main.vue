<script setup lang="ts">
let Foo: new () => {
	$props: {
		onFoo: () => void;
	}
};
</script>

<template>
	<Foo @foo="() => {}"></Foo>
</template>
