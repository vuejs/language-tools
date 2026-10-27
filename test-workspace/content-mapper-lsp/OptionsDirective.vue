<template>
	<div v-my-dir v-focus></div>
</template>

<script lang="ts">
const myDir = { mounted() {} };
export default {
	directives: { myDir, Focus: { mounted() {} } },
};
</script>
