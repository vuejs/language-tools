<template>
   {{ foo }}
 <!-- ^^^rename: bar -->
</template>

<script lang="ts" setup>
const foo = 1;
   // ^^^rename: bar
</script>