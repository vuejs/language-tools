<script setup lang="ts">
import type { CSSProperties } from 'vue';

declare function Comp(props: {
	style: CSSProperties;
}): void;
</script>

<template>
	<Comp style="display: block;" />
</template>
