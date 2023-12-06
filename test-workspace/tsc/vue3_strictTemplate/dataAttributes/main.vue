<template>
	<div>
		<svg>
			<path stroke="#efefef" stroke-width="123" pathLength="10" />
			<path stroke="#efefef" :stroke-width="123" :pathLength="10" />
		</svg>
		<foo stroke-width="123" />
		<component :is="Foo" stroke-width="test"></component>
	</div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
	props: {
		strokeWidth: { type: String, required: true },
	}
});
</script>
