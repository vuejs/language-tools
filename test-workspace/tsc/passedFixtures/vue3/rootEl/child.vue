<script setup lang="ts">
import { exactType } from '../../shared';
import Base from './base.vue';
</script>

<template>
	<Base>
		{{ exactType($el, {} as HTMLAnchorElement) }}
	</Base>
</template>
