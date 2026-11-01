<template>
	<Comp :foo-bar />
	<Comp :fooBar />
	{{ { foo } }}
	{{ new Comp({ fooBar }) }}
</template>

<script setup lang="ts">
const fooBar = 1;
const foo = 1;
declare function Comp(props: { fooBar: number }): void;
</script>
