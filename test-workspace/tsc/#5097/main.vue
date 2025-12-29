<script setup lang="ts">
import { Main } from './child';

defineProps<{
    foo: string;
}>();
</script>

<template>
    <Main bar=""></Main>
</template>
