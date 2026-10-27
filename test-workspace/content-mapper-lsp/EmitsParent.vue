<template>
	<TypeEmits @foo-bar="onFoo" />
	<TypeEmits @fooBar="onFoo" />
</template>

<script setup lang="ts">
import TypeEmits from './TypeEmits.vue';
function onFoo() {}
</script>
