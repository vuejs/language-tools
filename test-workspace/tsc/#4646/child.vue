<script lang="ts" setup>
import type { PropType } from 'vue';
import { exactType } from '../shared';

const msg = defineModel('msg', {
	type: String as PropType<string | null>,
	required: true,
});

exactType(msg.value, {} as string | null);
</script>

<template>
	{{ msg }}
</template>
