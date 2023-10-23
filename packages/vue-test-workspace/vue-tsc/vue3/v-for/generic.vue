<template>
	<div v-for="(val, key) in ({} as T)">
		{{ exactType(val, {} as T[keyof T]) }}
		{{ exactType(key, {} as keyof T) }}
	</div>
</template>

<script lang="ts" setup generic="T extends Record<string, string>">
import { exactType } from '../../shared';
</script>
