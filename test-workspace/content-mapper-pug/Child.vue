<script setup lang="ts">
defineSlots<{ default(props: { slotValue: string }): unknown }>();
</script>

<template lang="pug">
slot(slotValue="v")
</template>
