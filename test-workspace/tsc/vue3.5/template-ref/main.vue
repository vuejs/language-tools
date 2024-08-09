<script setup lang="ts">
import TemplateRef from "./template-ref.vue";
import { exactType } from "tsc/shared";
</script>

<template>
  <TemplateRef ref="templateRef" />

  {{ exactType($refs.templateRef?.$refs.generic?.foo, {} as 1 | undefined) }}
</template>
