<template>
	<div>
		<slot name="foo" :value="123"></slot>
	</div>
	
	<comp>
		<template #foo="{ value }">
			{{ exactType(value, {} as number) }}
		</template>
	</comp>
</template>

<script setup lang="ts">
import { exactType } from '../shared';
</script>
