<template>
	<input ref="foo" />
	<div :[foo]="123"></div>
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
const foo = useTemplateRef('foo')
</script>
