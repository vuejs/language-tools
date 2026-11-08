<script setup lang="ts">
import Child from './child.vue';

function onBaz(_: number) {}
</script>

<template>
	<UnknownWidget />
	<unknown-widget :foo="1" bar="x" @baz="onBaz" />
	<UnknownWidget v-slot="{ item }">{{ item }}</UnknownWidget>

	<Child foo="ok" #default="{ n }">{{ n.toFixed() }}</Child>
	<Child :foo="1" />
	<Child foo="ok" #default="{ n }">{{ n.notExist }}</Child>
</template>
