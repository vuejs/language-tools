<script setup lang="tsx">
import { exactType } from '../../shared';

defineOptions({
  name: 'Foo',
});

defineSlots<{
  default: (props: { foo: 0 }) => any
}>();
</script>

<template>
	<Foo v-slot="{ foo }">
		{{ exactType(foo, 0) }}
	</Foo>  
</template>
