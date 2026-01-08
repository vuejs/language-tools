<template>
	<div>
		<!-- @vue-ignore -->
		<div :foo="foo">
			<!-- @vue-expect-error -->
			{{ foo }}
		</div>
		<!-- @vue-expect-error -->
		<div :foo="foo">
			<!-- @vue-expect-error -->
			{{ foo }}
		</div>
		<!-- @vue-skip -->
		<div :foo="foo">
			{{ foo }}
		</div>

		<!-- @vue-ignore -->
		{{ foo }}
		<!-- @vue-expect-error -->
		{{ foo }}
		<!-- @vue-skip -->
		{{ foo }}

		<!-- @vue-ignore -->
		<div v-if="true" :foo="foo"></div>
		<!-- @vue-expect-error -->
		<div v-if="true" :foo="foo"></div>

		<!-- @vue-ignore -->
		<div v-for="_a in 10" :foo="foo"></div>
		<!-- @vue-expect-error -->
		<div v-for="_a in 10" :foo="foo"></div>
	</div>
</template>
