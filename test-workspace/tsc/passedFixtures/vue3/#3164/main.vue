<script setup lang="ts" generic="T">
defineProps<{ num: number }>()
defineModel<T>();
</script>

<template>
	{{ $props.num }}
	{{ $props.modelValue }}
</template>
