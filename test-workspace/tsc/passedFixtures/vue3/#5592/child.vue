<script setup lang="ts" generic="T">
defineOptions({ inheritAttrs: false });
defineProps</* @vue-ignore */ T>();
</script>

<template>
	<slot v-bind="$attrs as T" />
</template>
