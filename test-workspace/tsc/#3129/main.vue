<script lang="ts" setup>
import { ref } from 'vue';

const statusTag = ref('bar');
</script>

<template>
	<component :is="statusTag"></component>
</template>
