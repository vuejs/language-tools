<script setup lang="ts" generic="T">
defineOptions({ inheritAttrs: false });
defineProps<T>();
</script>

<template>
	<slot v-bind="$attrs as T" />
</template>
