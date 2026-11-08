<script setup lang="ts">
import { exactType } from '../shared';

defineProps<{ a?: string }>();
defineEmits<{ foo: []; bar: [n: number]; 'update:a': [value: string] }>();
defineSlots<{ default(props: { onPing?: (n: number) => void }): any }>();
</script>

<template>
	<slot @ping="exactType($event, {} as number); void 0" />
</template>
