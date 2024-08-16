<template>
	<!-- @vue-expect-error -->
	<Foo @click="() => {}"></Foo>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({});
</script>