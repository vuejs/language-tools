<script setup lang="ts">
import { exactType } from '../../shared';
import Child from './child.vue';
</script>

<template>
	<Child>
		{{ exactType($el, {} as HTMLAnchorElement) }}
	</Child>
</template>
