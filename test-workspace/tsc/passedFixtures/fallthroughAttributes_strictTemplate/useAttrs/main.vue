<script setup lang="ts">
import { type AnchorHTMLAttributes, type ReservedProps, useAttrs } from 'vue';
import { exactType } from '../../shared';

const attrs = useAttrs();
exactType(attrs, {} as Partial<AnchorHTMLAttributes & ReservedProps> & Record<string, unknown>);
</script>

<template>
	<a></a>
</template>