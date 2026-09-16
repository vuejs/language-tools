<script setup lang="ts">
defineProps<{ result: { kind: 'ok'; data: string } | { kind: 'err' } }>()
</script>
<template v-match="result" lang="html">
  <p v-when="{ kind: 'ok', const data } if (data.length)">{{ data }}</p>
  <p v-when="{ kind: 'err' }">error</p>
</template>
