<!-- @inferComponentDollarEl true -->
<!-- @inferTemplateDollarEl true -->
 
<script setup lang="ts">
import { exactType } from '../../shared';
import Base from './base.vue';
</script>

<template>
	<Base v-if="true">
		{{ exactType($el, {} as HTMLAnchorElement | HTMLImageElement) }}
	</Base>
	<Transition v-else>
		<img />
	</Transition>
</template>
