<script lang="ts" setup>
import { exactType } from '../../shared';

defineProps({
	foo: String
});

defineModel();
</script>

<template>
	{{ exactType(foo, {} as string | undefined) }}
</template>
