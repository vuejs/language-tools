<script setup>
// @ts-check
defineModel('foo');
</script>

<template>
	{{ $emit('update:foo', 'bar') }}
</template>
