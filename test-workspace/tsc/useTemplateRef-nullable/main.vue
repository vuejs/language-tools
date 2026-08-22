<template>
	<input ref="foo" />
	{{ foo.bar }}
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
const foo = useTemplateRef('foo')
</script>
