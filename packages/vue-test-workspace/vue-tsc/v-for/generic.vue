<template>
	<div v-for="(val, key) in ({} as T)">
		{{ exactType(val, {} as T extends any ? T[keyof T] : never) }}
		{{ exactType(key, {} as T extends any ? keyof T : never) }}
	</div>
</template>

<script lang="ts" setup generic="T extends Record<string, string>">
import { exactType } from '../shared';
</script>
