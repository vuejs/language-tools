<template>
	<div class="main">
		<template v-for="(item, i) in list as any[]" :key="i">
			<div class="row">{{ item.name }}</div>
		</template>
		<div :foo="value as string" :bar="1"></div>
		<div :foo='value as string' :bar="1"></div>
		<div :foo="value satisfies string" :bar="1"></div>
		<div :foo="value as Array<string>" :bar="1"></div>
		<div :foo="value as 'a' | 'b'" :bar="1"></div>
		<div @click="handler(value as string)" :bar="1"></div>
		<div v-if="value as boolean" :bar="1"></div>
		<div :foo="value as string[]" :bar="1"></div>
		<div :foo="value as const" :bar="1"></div>
		<div :foo="(value as string).length" :bar="1"></div>
		<div :foo="cond ? value as string : other" :bar="1"></div>
		<div :foo="'as ' + value" :bar="1"></div>
		<div :foo="{ as: value }" :bar="1"></div>
		<div :foo="value.as" :bar="1"></div>
	</div>
</template>

<script setup lang="ts">
const list: any = []
</script>
