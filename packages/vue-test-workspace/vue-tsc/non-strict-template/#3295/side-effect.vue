<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

const x = <T>(x: T) => x;
</script>

<template>
	<div>
		{{ exactType(x(1), 1) }}
	</div>
</template>
