<script setup lang="ts">
import Directive from './directive.vue';
import Imports from './imports.vue';
import Setup from './setup.vue';
import SetupComment from './setup-comment.vue';
</script>

<template>
	<Setup msg="" />
	<!-- @vue-expect-error -->
	<Setup :msg="0" />
	<SetupComment msg="" />
	<!-- @vue-expect-error -->
	<SetupComment :msg="0" />
	<Directive />
	<Imports />
</template>
