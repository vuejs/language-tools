<script setup lang="ts">
import { object, Role } from './constants';

const router = { push(_path: string) {} };
</script>

<template>
	<div v-if="false">{{ Role.Admin }}{{ router.push('/') }}</div>
	<div v-if="true" />
	<div v-else>{{ object.locale.value }}</div>
	<div v-if="true /* comment */" />
	<div v-else>{{ Role.Admin }}</div>
</template>
