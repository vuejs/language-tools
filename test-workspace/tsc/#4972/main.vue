<script lang="ts" setup>
import { ref } from 'vue';
import GenericComp from './GenericComp.vue';
const n = ref(0)
</script>

<template>
	<GenericComp v-model="n" />
	<!-- @vue-expect-error -->
	<GenericComp />
	<!-- @vue-expect-error -->
	<GenericComp whatever="''" />"
</template>
