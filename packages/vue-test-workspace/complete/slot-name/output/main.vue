<template>
  <Foo>
    <template #default></template>
          <!-- ^complete: default -->
  </Foo>
</template>

<script lang="ts" setup>
let Foo: new () => {
  $props: {};
  $slots: {
    default: any;
  };
};
</script>
