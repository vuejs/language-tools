<script setup lang="ts">
declare const Foo: new () => {
  $props: {
    FooBar: string;
  };
};
</script>

<template>
  <Foo :- ></Foo>
    <!-- ^complete: :-foo-bar -->
</template>
