<script setup lang="ts"> 
type Foo = string
defineProps<{
	foo: Foo
}>()
</script>

<template>
	<div>{{ foo }}</div>
</template>
