<script setup lang="ts">
import Child from './child.vue';
</script>

<template>
	<template v-if="true">
		<Child />
	</template>
	<template v-else-if="true">
		<transition>
			<a></a>
		</transition>
	</template>
	<template v-else>
		<img />
	</template>
</template>
