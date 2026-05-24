<script setup lang="ts">
import FooBar from './FooBar';
</script>

<template>
	<FooBar :stuff-and-things="7" class="foo-bar" />
</template>

<style scoped>
.foo-bar {
	color: blue;
}
</style>
