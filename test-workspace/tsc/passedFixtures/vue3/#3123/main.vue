<script setup lang="ts">
import { FunctionalComponent, SVGAttributes } from 'vue';

declare const VueSvg: FunctionalComponent<SVGAttributes>;
</script>

<template>
	<div>
		<a href="https://vitejs.dev" target="_blank">
			<img src="/vite.svg" class="logo" alt="Vite logo" />
		</a>
		<a href="https://vuejs.org/" target="_blank">
			<VueSvg width="96" class="logo vue" fill-opacity="0.5" />
		</a>
	</div>
</template>
