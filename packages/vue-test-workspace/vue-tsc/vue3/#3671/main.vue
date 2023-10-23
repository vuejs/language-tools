<template>
	{{ slots.footer }}
</template>

<script lang="ts" setup generic="T extends string">
const slots = defineSlots<Record<T, () => any> & { footer(props: { id: number; }): any; }>();
</script>
