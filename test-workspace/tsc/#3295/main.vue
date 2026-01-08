<template>
	<article>
		<div v-if="record[sym]">Hi</div>
	</article>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const sym = Symbol('sym');

const record = ref({ [sym]: true });
record.value[sym];
</script>
