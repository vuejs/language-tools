<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

const ReloadPrompt =
	typeof window !== 'undefined'
		? defineAsyncComponent(() => Promise.resolve({}))
		: undefined;
</script>

<template>
	<template v-if="ReloadPrompt">
		<ReloadPrompt />
	</template>
</template>
