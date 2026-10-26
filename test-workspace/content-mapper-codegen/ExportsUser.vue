<script setup lang="ts">
import ExportsScript, { ExportsScript as NamedExportsScript } from './ExportsScript.vue';
import NamedDefault, { NamedExport } from './NamedExport.vue';
import NoDefaultDefault, { NoDefault } from './NoDefault.vue';
</script>

<template>
	<ExportsScript />
	<NamedExportsScript />
	<NamedDefault />
	<NamedExport />
	<NoDefaultDefault />
	<NoDefault />
</template>
