<script setup lang="ts">
const result = { kind: 'ok', data: [1, 2] }
</script>
<template>
  <template v-match="result">
    <p v-when="{ kind: 'ok', data: [const first, ...const tail], ...const metadata } as success if (first > 0 && tail.length)">{{ first }}</p>
    <p v-when="('idle' | 'pending') as waiting">{{ waiting }}</p>
    <p v-when="Status.Error">error</p>
    <p v-when="{ kind: _, ... }">known</p>
    <p v-when='[1, "two", ...]'>tuple</p>
    <p v-when="_">empty</p>
  </template>
  <p :title="result.kind">after pattern</p>
</template>
