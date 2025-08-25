<script
  lang="ts"
  setup
>
interface Foo {
  name: string;
}
</script>

<script
  lang="jsx"
>
const element = <div>Hello</div>;
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

<style
  lang="css"
>
.test2 {
  background: red;
}
</style>

<template>
  <div>Hello</div>
</template>