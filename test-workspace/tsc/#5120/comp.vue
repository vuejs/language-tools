<!-- @inferComponentDollarEl true -->

<script lang="ts" setup generic="T">
const doSomething = () => {
	console.log('Something!' as unknown as T);
};

defineExpose({ doSomething });
</script>

<template>
	<div>Example component</div>
</template>
