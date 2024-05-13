<template>
	<!-- @vue-expect-error -->
	<Teleport to="/contact" @eventDoesNotExist="() => { }" />
</template>
