<script setup lang="ts">
import { exactType } from '../shared';
import { computed, onMounted, ref } from 'vue';
import { ConstMode, count, Mode, options, state } from './constants';

let flag = false;
function toggle() {
	flag = !flag;
}
let nullable: { value: number } | undefined;
function reset() {
	nullable = undefined;
}
const status = ref<'uploading' | 'uploaded' | 'error'>('uploading');
status.value = 'uploading';
onMounted(() => { status.value = 'error'; });
const readonlyCount = computed(() => count.value);
const splitCount = computed({ get: () => count.value, set: (value: string) => { count.value = Number(value); } });
</script>

<template>
	<div>{{ exactType(Mode.Regular, Mode.Regular) }}</div>
	<div>{{ exactType(ConstMode.Regular, ConstMode.Regular) }}</div>
	<button @click="() => exactType(Mode.Regular, Mode.Regular)" />
	<button @click="() => exactType(ConstMode.Regular, ConstMode.Regular)" />
	<button @click="exactType(ConstMode.Regular, ConstMode.Regular)" />
	<button @click="() => exactType(options.mode, {} as Mode)" />
	<button @click="() => exactType(state.mode, {} as Mode)" />
	<button @click="() => { if (flag) toggle(); }" />
	<button @click="() => { if (nullable) exactType(nullable.value, {} as number); reset(); }" />
	<button @click="() => count++" />
	<button @click="() => { count = 5; }" />
	<button @click="function () { exactType(options.mode, {} as Mode); }" />
	<button @click="() => options.mode || (() => options.mode)()" />
	<button @click="(_event, mode = options.mode) => exactType(mode, {} as Mode)" />
	<button @click="(_event, { mode = options.mode } = {}) => exactType(mode, {} as Mode)" />
	<div>{{ ({ get mode() { return options.mode; } }).mode }}</div>
	<div>{{ [0].map(() => options.mode) }}</div>
	<div>{{ [0].map(() => ({ options })).map(({ options }) => exactType(options.mode, {} as Mode)) }}</div>
	<div>{{ [{ mode: 'local' }].map(options => exactType(options.mode, {} as string)) }}</div>
	<span v-if="status === 'error'">error</span>
	<div v-if="false">{{ options.mode }} {{ Mode.Regular }}</div>
	<div v-if="true" />
	<div v-else>{{ options.mode }} {{ Mode.Regular }}</div>
	<div>{{ [1].map((): number => count) }}</div>
	<!-- @vue-expect-error -->
	<button @click="[1].map((): string => count)" />
	<!-- @vue-expect-error -->
	<button @click="(function (x = 1) { 'use strict'; return count + x; })()" />
	<!-- @vue-expect-error -->
	<button @click="((x = 1) => { 'use strict'; return count + x; })()" />
	<!-- @vue-expect-error -->
	<button @click="() => readonlyCount++" />
	<button @click="() => { splitCount = '5'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { splitCount = 5; }" />
	<!-- @vue-expect-error -->
	<button @click="() => Mode.Missing" />
	<!-- @vue-expect-error -->
	<button @click="() => options.missing" />
</template>
