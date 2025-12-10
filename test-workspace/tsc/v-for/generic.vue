<template>
	<div v-for="(val, key) in ({} as T)">
		{{ exactType(val, {} as string | boolean) }}
		{{ exactType(key, {} as string | number) }}
	</div>
</template>

<script lang="ts" setup generic="T extends Record<string, string> | boolean[]">
import { exactType } from '../shared';
</script>
