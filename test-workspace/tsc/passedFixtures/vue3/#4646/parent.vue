<template>
  <child v-model:msg="msg" />
  <child :msg="msg" @update:msg="v => exactType(v, {} as string|null)" />

  <child2 v-model:other="other" />
</template>
<script lang="ts" setup>
import { exactType } from '../../shared';
import { ref } from 'vue'
import child from './child.vue'
import child2 from './child2.vue'

const msg = ref<string | null>('test')
const other = ref<string | null>('test2')
</script>
