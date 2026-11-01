<script setup lang="ts">
import ExportsScript, { ExportsScript as NamedExportsScript } from './ExportsScript.vue';
import NamedDefault, { NamedExport, SecondExport } from './NamedExport.vue';
import NoDefaultDefault, { NoDefault } from './NoDefault.vue';
</script>

<template>
	<ExportsScript />
	<NamedExportsScript />
	<NamedDefault />
	<NamedExport />
	<SecondExport />
	<NoDefaultDefault />
	<NoDefault />
</template>
