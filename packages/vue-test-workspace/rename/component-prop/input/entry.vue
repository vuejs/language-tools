<template>
    <Comp :aaa-bbb="'foo'"></Comp>
    <Comp :aaaBbb="'foo'"></Comp>
</template>

<script lang="ts" setup>
import Comp from './component.vue';
</script>