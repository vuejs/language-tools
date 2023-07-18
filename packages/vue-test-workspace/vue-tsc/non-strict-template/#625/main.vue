<template>
	<MyComponent>
		<template v-if="status" #default>
			{{ status.message }}
		</template>
	</MyComponent>
</template>
  
<script lang="ts" setup>
let status: { message: string } | undefined;
let MyComponent: any;
</script>
