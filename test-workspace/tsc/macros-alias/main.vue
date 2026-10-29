<script setup lang="ts">
import { defineProps as dp } from 'vue';
const props = dp<{ foo: string }>();
</script>

<template>
	{{ props.foo }}
</template>
