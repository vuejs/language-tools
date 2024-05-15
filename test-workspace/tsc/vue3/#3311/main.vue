<template>
	<HelloWorld :multiple="true" :modelValue="['a']" />
	<HelloWorld :multiple="false" :modelValue="'a'" />
	<HelloWorld :modelValue="'a'" />
	<!-- @vue-expect-error -->
	<HelloWorld :multiple="true" :modelValue="'a'" />
	<!-- @vue-expect-error -->
	<HelloWorld :multiple="false" :modelValue="['a']" />
	<!-- @vue-expect-error -->
	<HelloWorld :modelValue="['a']" />
</template>

<script lang="ts" setup>
import HelloWorld from './component.vue';
</script>
