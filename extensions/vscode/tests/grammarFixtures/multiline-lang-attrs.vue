<script
  lang="ts"
  setup
>
interface TestInterface {
  value: string;
}

type TestType = string;
</script>

<style
  lang="scss"
  scoped
>
$primary-color: #333;

.component {
  color: $primary-color;
  
  &:hover {
    opacity: 0.8;
  }
}
</style>

<template>
  <div class="component">
    Multiline attributes test
  </div>
</template>