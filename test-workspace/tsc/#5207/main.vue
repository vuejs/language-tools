<script lang="ts" setup>
declare function Comp(props: { fooBarBaz: number; }): void;
</script>

<template>
  <!-- @vue-expect-error -->
  <Comp foo-bar-baz="1"></Comp>
</template>
