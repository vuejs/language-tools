<script setup lang="ts">
import { ref } from 'vue';

const values = ref([1, 2, 3]);
const abc = ref('abc');
</script>

<template>
  <div>
    <input v-for="value of values" :key="value" type="number" :value />
    <span :abc></span>
  </div>
</template>
