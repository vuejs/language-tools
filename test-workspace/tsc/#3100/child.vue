<template>
  <div class="modal" :class="{ 'modal-large': large }" v-show="show">
    <div>
      <slot />
    </div>
    <div>
      <button type="button" @click="$emit('close')">close</button>
      <button type="button" @click="$emit('update:show', false)">update:show</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(['close', 'update:show'])

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  large: {
    type: Boolean,
    default: false
  }
})
</script>
