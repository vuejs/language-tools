<script setup lang="ts">
import child from './child.vue';
</script>

<template>
  <child #default="{ foo, bar }" :foo="42" bar="baz">
    {{ foo }} {{ bar }}
  </child>
</template>
