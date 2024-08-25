<template>
	<div @click></div>
	<div @click="{}"></div>
	<div @click="log('hello'); log('world');"></div>
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
	<div .prop="[1, 2]"></div>
	<div v-a:[({a:1}).a]="1"></div>
	<div v-a:[c]></div>
	<div v-a:[({a:1}).a].d="[1, 2]"></div>
	<div @[({a:1}).a].d="[1, 2]" v-d:[2]="3"></div>
	<div :[1]="value"></div>
	<div v-bind="{ id: someProp, 'other-attr': otherProp }"></div>
	<div :xlink:special.d="3"></div>
	<div v-a.c.d="3"></div>
</template>

<template lang="pug">
div(@click)
div(@click="{}")
div(@click="log('hello'); log('world');")
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
div(.prop="[1, 2]")
</template>

<template lang="pug">
h1.myClass(class="text-right") hello
//- https://github.com/vuejs/language-tools/issues/1826
h1#myId(class="text-right") hello
</template>

<!-- TODO -->
<template lang="html">
	<div @click></div>
	<div @click="{}"></div>
	<div @click="log('hello'); log('world');"></div>
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
	<div .prop="[1, 2]"></div>
</template>
