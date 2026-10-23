<script setup lang="ts">
import { exactType } from '../shared';
import { count, maybe, object, readonlyCount, Role } from './constants';

let flag = false;
function toggle() { flag = !flag; }
const other = { label: 'other' };
function takeString(_callback: () => string) {}
</script>

<template>
	<button @click="async () => { object.locale.value = 'it'; }" />
	<button @click="() => exactType(Role.Admin, {} as Role.Admin)" />
	<div>{{ [1].map(() => Role.Admin) }}</div>
	<button @click="() => { if (maybe) exactType(maybe, {} as string); }" />
	<button @click="() => { if (flag) toggle(); }" />
	<button @click="() => count++" />
	<button @click="() => { count = 1; }" />
	<button @click="() => (() => object.locale.value)()" />
	<button @click="() => object" />
	<button @click="() => (() => object)()" />
	<div>{{ [1].map(() => object.locale.value && other) }}</div>
	<div>{{ [1].map(() => other && object.locale.value) }}</div>
	<button @click="function () { return object.locale.value; }" />
	<div>{{ ({ method() { return object.locale.value; } }).method() }}</div>
	<!-- @vue-expect-error -->
	<button @click="() => { if (maybe) exactType(maybe, {} as number); }" />
	<!-- @vue-expect-error -->
	{{ [1].map<string>(() => count) }}
	<!-- @vue-expect-error -->
	{{ takeString(() => count) }}
	<!-- @vue-expect-error -->
	{{ [1].map((): string => count) }}
	<!-- @vue-expect-error -->
	<button @click="() => ++readonlyCount" />
	<!-- @vue-expect-error -->
	{{ (function (x = 1) { 'use strict'; return count + x; })() }}
	<!-- @vue-expect-error -->
	{{ ((x = 1) => { 'use strict'; return count + x; })() }}
</template>
