<script setup lang="ts">
declare const Foo: new () => {
  $props: {
    FooBar: string;
  };
};
</script>

<template>
  <Foo :-foo-bar="" ></Foo>
    <!-- ^complete: :-foo-bar -->
</template>
