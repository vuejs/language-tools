<template>
	<div @['click']="{
		isActive = false;
		frame = 0;
	}" />
</template>

<script lang="ts" setup>
let isActive = false;
let frame = 0;
</script>
