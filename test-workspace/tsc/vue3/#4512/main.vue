<template>
	<!-- @vue-expect-error -->
	<Test1 v-model:opened="test"></Test1>

	<!-- @vue-expect-error -->
	<Test2 v-model:opened="test"></Test2>

	<!-- @vue-expect-error -->
	<Test3 v-model:opened="test"></Test3>
	<Test3 v-model:opened="test3ok"></Test3>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import Test1 from './test1.vue'
import Test2 from './test2.vue'
import Test3 from './test3.vue'

const test3ok = ref({
	asdf: 1,
})
const test = ref(0)
</script>
