<script lang="ts" setup>
import { ref } from 'vue';
import GenericComp from './GenericComp.vue';
const n = ref(0)
</script>

<template>
	<GenericComp v-model="n" />
	<GenericComp />
	<GenericComp whatever="''" />"
</template>
