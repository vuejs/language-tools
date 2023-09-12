<template>
	<!-- template slots type -->
	<slot name="bar" str="str" :num="1"></slot>

	<!-- typed slot key -->
	<slot :name="baz" str="str" :num="1"></slot>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const baz = ref('baz' as const);
</script>
