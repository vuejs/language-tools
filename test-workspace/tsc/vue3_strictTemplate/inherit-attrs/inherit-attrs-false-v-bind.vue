<script>
import { defineComponent } from 'vue';

export default defineComponent({
	inheritAttrs: false,
});
</script>

<script setup lang="ts">
import child from './child.vue';
</script>

<template>
	<child v-bind="$attrs"></child>
</template>
