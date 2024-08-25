<script setup lang="ts">
import { ref } from 'vue'
import Child from './child.vue'

const isModalOpen1 = ref(false)
const isModalOpen2 = ref(false)
</script>

<template>
  <div>
    <div>
      <button @click="isModalOpen1 = true">Show Dialog 1 (<code>close</code> event)</button>
      <Child :show="isModalOpen1" :large="true" @close="isModalOpen1 = false">
        This dialog uses the <code>close</code> event to close
      </Child>
    </div>

    <div>
      <button @click="isModalOpen2 = true">Show Dialog 2 (<code>update:show</code> event)</button>
      <!-- errors are on 'show' and 'large' props here -->
      <Child :show="isModalOpen2" :large="true" @update:show="isModalOpen2 = $event">
        This dialog uses the <code>update:show</code> event to close
      </Child>
    </div>
  </div>
</template>
