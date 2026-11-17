<script setup lang="ts">
import { ref } from 'vue';
import { exactType } from '../shared';

const obj = { value: 'a', label: 'Name' };
const maybe = { value: 'a' as string | undefined };
const { nested } = { nested: ref(1) };
</script>

<template>
	<span v-bind="obj" />
	<b>{{ exactType(obj, {} as { value: string; label: string }) }}</b>
	<b>{{ exactType(obj.value, {} as string) }}</b>
	<b v-if="maybe.value">{{ exactType(maybe.value, {} as string) }}</b>
	<b>{{ exactType(nested, {} as number) }}</b>
</template>
