<script setup lang="ts">
import child from './child.vue'
import minimal from './minimal.vue'
</script>

<template>
  <div>
    <child
      required-model=""
      required-prop=""
    />
    <minimal 
      another-model=""
      required-prop=""
    />
  </div>
</template>
