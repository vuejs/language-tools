<script lang="ts">
import { defineComponent } from 'vue';
import DropComponent from '@/components/deep/DropComponent.vue';

export default defineComponent({
	components: {
		// shown on every page
		DropComponent,
	},
});
</script>

<template>
	<DropComponent />
</template>
