<script setup lang="ts">
import { useTemplateRef } from "vue";
import TemplateRef from "./template-ref.vue";
import { exactType } from "tsc/shared";

const templateRef = useTemplateRef("templateRef");
</script>

<template>
  <TemplateRef ref="templateRef" />

	{{ exactType(templateRef?.$refs.generic?.foo, {} as 1 | undefined) }}
	
  {{ exactType($refs.templateRef?.$refs.generic?.foo, {} as 1 | undefined) }}
</template>
