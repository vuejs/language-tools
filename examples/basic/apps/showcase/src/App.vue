<script setup lang="ts">
import {GenericSelect} from '@examples/ui'
import {ref} from 'vue'

const selected = ref<string | null>(null)
</script>

<template>
  <div>
    <h1>Showcase</h1>
    <GenericSelect v-model="selected" :options="[]"></GenericSelect>
  </div>
</template>
