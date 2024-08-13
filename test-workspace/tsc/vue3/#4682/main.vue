<template>
  <div v-object="[1, (_a: 1) => {}]"></div>
  <!-- @vue-expect-error -->
  <div v-object="2"></div>

	<div v-function="[1, (_a: 1) => {}]"></div>
	<!-- @vue-expect-error -->
	<div v-function="2"></div>
</template>

<script lang="ts" setup>
const vObject = {
  created<T extends number>(
    _el: HTMLElement,
    _binding: { value: [T, (a: T) => void] }
  ) { },
  mounted<T extends number>(
    _el: HTMLElement,
    _binding: { value: [T, (a: T) => void] },
		_vNode: any,
  ) { },
};

function vFunction<T extends number>(_el: any, _binding: { value: [T, (a: T) => void] }) { }
</script>
