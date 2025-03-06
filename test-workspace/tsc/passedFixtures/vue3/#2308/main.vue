<template>
	<slot name="label" v-bind="{ name: 'foo' }"></slot>
	<slot :name="'label'" v-bind="{ name: 'foo' }"></slot>
</template>
