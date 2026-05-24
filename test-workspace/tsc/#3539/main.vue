<script setup lang="ts">
import { ref } from 'vue';

const msg = ref('Hello World!');
</script>

<template>
	<!-- @vue-expect-error -->
	<Hello :msg="msg"></Hello>
</template>
