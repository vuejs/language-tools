<script setup lang="ts">
import Child from './child.vue';
</script>

<template>
	<!-- should report TS2578: the directive is unused -->
	<!-- @vue-expect-error -->
	<Child :cb="n => n.toFixed()" />
</template>
