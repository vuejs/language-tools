<script setup lang="ts">
import { exactType } from '../shared';
import child from './child.vue';
</script>

<template>
  <child #default="{ foo, bar }" :foo="42" bar="baz">
    {{ exactType(foo, {} as number) }} {{ exactType(bar, {} as string) }}
  </child>
</template>
