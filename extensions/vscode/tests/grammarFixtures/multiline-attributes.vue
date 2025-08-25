<script
  lang="ts"
  setup
>
interface Foo {
  name: string;
}

type Bar = string;
</script>

<style
  lang="scss"
  scoped
>
$primary: #333;

.test {
  color: $primary;
}
</style>

<template>
  <div>Hello</div>
</template>