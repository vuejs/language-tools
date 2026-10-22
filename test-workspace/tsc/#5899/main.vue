<template lang="pug">
Input(v-bind="$attrs")
	template(v-if="$props" #errorMessage)
		slot(v-if="$attrs" name="errorMessage")
			| {{ $props }}
</template>
