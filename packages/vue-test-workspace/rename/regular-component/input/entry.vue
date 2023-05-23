<template>
   {{ foo }}
 <!-- ^^^rename: bar -->
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
   setup() {
      return {
         foo: 1,
      // ^^^rename: bar
      };
   },
});
</script>