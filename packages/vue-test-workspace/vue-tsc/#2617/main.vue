<script lang="ts" setup>
let UntypedComponent: new () => {
	$slots: {
		default: (_: any) => any
	}
} = {} as any;
</script>

<template>
	<UntypedComponent>
		<template #default="data: { foo: string }">
			{{ data.foo }}
		</template>
	</UntypedComponent>
</template>
