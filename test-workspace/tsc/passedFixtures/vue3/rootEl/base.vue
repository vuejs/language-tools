<script setup lang="ts">
import { exactType } from '../../shared';
</script>

<template>
	<a>{{ exactType($el, {} as HTMLAnchorElement) }}</a>
</template>
