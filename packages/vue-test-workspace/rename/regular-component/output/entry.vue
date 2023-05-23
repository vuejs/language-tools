<template>
   {{ bar }}
 <!-- ^^^rename: bar -->
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
   setup() {
      return {
         bar: 1,
      // ^^^rename: bar
      };
   },
});
</script>