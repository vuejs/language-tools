<script setup lang="ts">
import { Component } from "vue";
import { defineComponent } from "vue";
const A = {
  B: {
    C: defineComponent({
      setup() {
        return () => "";
      },
    }),
  },
};
const C: Component & {
  D: Component;
} = null!;
</script>

<template>
  <A.B.C> {{ A.B.C }} </A.B.C>
  <A.B.C />
  <C>
    <C.D> 222 </C.D>
    <C.D />
  </C>
</template>
