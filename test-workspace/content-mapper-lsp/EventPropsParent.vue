<template>
	<EventProps @foo-bar="onFoo" />
	<EventProps @fooBar="onFoo" />
</template>

<script setup lang="ts">
import EventProps from './EventProps.vue';
function onFoo() {}
</script>
