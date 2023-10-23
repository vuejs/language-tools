<template>
	<div>
		<slot name="foo" :value="123"></slot>
	</div>

	<foo>
		<template #foo="{ value }">
			{{ exactType(value, {} as number) }}
		</template>
	</foo>
</template>

<script setup lang="ts">
import { exactType } from '../../shared';
</script>
