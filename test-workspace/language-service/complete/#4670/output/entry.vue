<script setup lang="ts">
import Comp from './comp.vue';
</script>

<template>
	<Comp :on-foo=""/>
	    <!-- ^complete: :on-foo -->
</template>
