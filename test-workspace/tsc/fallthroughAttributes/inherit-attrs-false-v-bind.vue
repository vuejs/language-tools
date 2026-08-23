<script>
import { defineComponent } from 'vue';

export default defineComponent({
	inheritAttrs: false,
});
</script>

<script setup lang="ts">
import basic from './basic.vue';
</script>

<template>
	<basic v-bind="$attrs"></basic>
</template>
