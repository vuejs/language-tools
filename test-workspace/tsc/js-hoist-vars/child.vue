<script setup>
import { useTemplateRef } from 'vue';
import Leaf from './leaf.vue';

const leaf = useTemplateRef('leaf');
const name = /** @type {'foo' | 'bar'} */ ('foo');
</script>

<template>
	<slot :num="1"></slot>
	<slot name="named" str="str"></slot>
	<slot :name="name" :bool="true"></slot>
	<Leaf ref="leaf" />
	{{ leaf }}
</template>
