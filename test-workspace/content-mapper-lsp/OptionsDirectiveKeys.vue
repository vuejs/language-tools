<template>
	<div v-kebab-dir v-spread-dir></div>
</template>

<script lang="ts">
const spread = { spreadDir: { mounted() {} } };
export default {
	directives: { 'kebab-dir': { mounted() {} }, ...spread },
};
</script>
