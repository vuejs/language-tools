<script setup lang="ts">
import Child from './Child.vue';
const count = 1;
</script>

<template lang="toy">
Child msg="hi"
Child
p | {{ count.toFixed() }}
p | {{ missing }}
</template>
