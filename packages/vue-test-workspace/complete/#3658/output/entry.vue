<template>
	<Comp>
		<template #foo="foo">
			{{ foo }}
			<!-- ^complete: foo -->
		</template>
	</Comp>
</template>
