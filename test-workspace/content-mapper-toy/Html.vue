<script setup lang="ts">
import Child from './Child.vue';
const count = 1;
</script>

<template>
<Child msg="hi" />
<Child />
<p>{{ count.toFixed() }}</p>
<p>{{ missing }}</p>
</template>
