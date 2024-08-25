<template>
	<Foo></Foo>
</template>

<script setup lang="ts">
let Foo!: ((props: { row: string }) => any) & (new () => any);
</script>
