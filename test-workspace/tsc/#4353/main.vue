<script setup lang='ts'>
import { type PropType } from 'vue'
</script>

<template>
	<!-- @vue-expect-error -->
	<input :data-t1="PropType.A" />
</template>
