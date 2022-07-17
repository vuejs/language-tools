<template>
    <Comp :ccc-ddd="'foo'"></Comp>
    <Comp :cccDdd="'foo'"></Comp>
</template>

<script lang="ts" setup>
import Comp from './component.vue';
</script>