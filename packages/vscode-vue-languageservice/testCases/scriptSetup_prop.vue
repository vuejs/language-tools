<template>{{ foo }}</template>

<script lang="ts" setup>
import { defineProps } from '@vue/runtime-core';
defineProps({ foo: String });
</script>