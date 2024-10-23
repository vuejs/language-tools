<script lang="ts">
import { exactType } from '../../shared';

export default {
	setup() {
		return {
			exactType,
			a: 1 as const,
		}
	}
};
</script>

<template>
	{{ exactType(a, {} as 1) }}
</template>

<style module>
.foo { }
</style>
