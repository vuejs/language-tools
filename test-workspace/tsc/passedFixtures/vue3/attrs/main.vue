<!-- @inferTemplateDollarAttrs true -->

<script setup lang="ts">
import { type AnchorHTMLAttributes, type ReservedProps, useAttrs } from 'vue';
import { exactType } from '../../shared';

type InheritedAttrs = Partial<AnchorHTMLAttributes & ReservedProps> & Record<string, unknown>;

const attrs = useAttrs();
exactType(attrs, {} as InheritedAttrs);
</script>

<template>
	<a>{{ exactType($attrs, {} as InheritedAttrs) }}</a>
</template>
