<template>
	<div v-for="(val, key) in ({} as T)">
		{{ exactType(val, {} as string | boolean) }}
		{{ exactType(key, {} as string | number) }}
	</div>
	<div v-for="(val, key) in ({} as TArr)">
		{{ exactType(val, {} as number) }}
		{{ exactType(key, {} as number) }}
	</div>
	<div v-for="(val, key) in ({} as TIter)">
		{{ exactType(val, {} as string) }}
		{{ exactType(key, {} as number) }}
	</div>
</template>

<script lang="ts" setup generic="T extends Record<string, string> | boolean[], TArr extends number[], TIter extends Iterable<string>">
import { exactType } from '../shared';
</script>
