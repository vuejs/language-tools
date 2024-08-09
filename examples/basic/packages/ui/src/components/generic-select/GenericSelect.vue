<template>
  <select v-model="model">
    <option v-for="option in props.options" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
</template>

<!--
  Important: To be able to use a generic props interface, we need to
  move the interface declaration to a seperate script block.
-->
<script lang="ts">
import {SelectOption} from '.'

interface Props<T> {
  options: SelectOption<T>[]
}
</script>

<script lang="ts" setup generic="T extends string|number, TValue extends T | null">
const props = defineProps<Props<T>>()

const model = defineModel<TValue>({required: true})
</script>
