<script setup>
defineEmits(['change']);
</script>

<template>
	<slot :num="1"></slot>
	<slot name="named" str="str"></slot>
</template>
