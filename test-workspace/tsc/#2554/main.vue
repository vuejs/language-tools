<template>
  <HelloWorld v-slot="{ foo }: any">
     The value of foo is: {{ foo }}
  </HelloWorld>
</template>

<script lang="ts" setup>
let HelloWorld: any;
</script>
