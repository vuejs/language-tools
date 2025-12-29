<script setup lang="ts">
const resetFunction = () => {
  console.log('reset')
}
const resetFunction2 = () => {
  console.log('reset2')
}
const searchFunction = () => {
  console.log('search')
}
const searchFunction2 = () => {
  console.log('search2')
}
</script>

<template>
  <component
    @reset="
      () => {
        resetFunction()
        resetFunction2()
      }
    "
    @search="
      () => {
        searchFunction()
        searchFunction2()
      }
    "
  />
</template>
