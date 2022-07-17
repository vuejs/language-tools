<template>
	<div @click></div>
	<div @click="{}"></div>
	<div #default></div>
	<div #default="args"></div>
	<div #></div>
	<div #="args"></div>
	<div :key></div>
	<div :key="{}"></div>
	<div v-if="true"></div>
	<div v-else-if="true"></div>
	<div v-else></div>
	<div v-for="n in []"></div>
	<div v-if="true" v-else-if="true" v-else></div>
	<div :foo="':foo=123'"></div>
	<div :foo="[{ bar: []}]"></div>
</template>

<template lang="pug">
div(@click)
div(@click="{}")
div(#default)
div(#default="args")
div(#)
div(#="args")
div(:key)
div(:key="{}")
div(v-if="true")
div(v-else-if="true")
div(v-else)
div(v-for="n in []")
div(v-if="true" v-else-if="true" v-else)
div(:foo="':foo=123'")
div(:foo="[{ bar: []}]")
</template>
