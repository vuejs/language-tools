<template>
	<RuntimeProps :aaa-bbb="'x'" />
	<RuntimeProps :aaaBbb="'x'" />
	<TypeProps :aaa-bbb="'x'" />
	<TypeProps :aaaBbb="'x'" />
</template>

<script setup lang="ts">
import RuntimeProps from './RuntimeProps.vue';
import TypeProps from './TypeProps.vue';
</script>
