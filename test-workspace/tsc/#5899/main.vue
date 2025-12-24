<template lang="pug">
Input(v-bind="$attrs")
	template(v-if="hasError || hasWarning" #errorMessage)
		slot(v-if="hasError" name="errorMessage")
			| {{ errorMessage }}
</template>
