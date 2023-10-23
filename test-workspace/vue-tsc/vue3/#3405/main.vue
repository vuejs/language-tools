<script setup lang="ts" generic="T">
import { exactType } from '../../shared';

const props = defineProps<{
	foo: T;
	bar: string;
}>();
</script>

<template>
	{{ exactType(props.bar, '' as string) }}
	{{ exactType(props.foo, {} as T) }}
</template>
