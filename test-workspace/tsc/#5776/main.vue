<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ msg: string }>();

const count = ref(eee);
</script>

<script lang="ts">
export default {
	name: '1212'
}
export const eee = 1
</script>

<template>
	<div class="flex items-center justify-center w-screen h-screen">
		{{ count }}
	</div>
</template>
