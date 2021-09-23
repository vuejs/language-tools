<template>
	<Comp @foo-bar="strFn"></Comp>
	<Comp @fooBar="strFn"></Comp>
	<Comp @foo-bar="numFn"></Comp>
	<Comp @fooBar="numFn"></Comp>
	<Comp @foo-bar="strFn($event)"></Comp>
	<Comp @fooBar="strFn($event)"></Comp>
	<Comp @foo-bar="numFn($event)"></Comp>
	<Comp @fooBar="numFn($event)"></Comp>
	<Comp @foo-bar="payload => strFn(payload)"></Comp>
	<Comp @fooBar="payload => strFn(payload)"></Comp>
	<Comp @foo-bar="payload => numFn(payload)"></Comp>
	<Comp @fooBar="payload => numFn(payload)"></Comp>
</template>

<script lang="ts" setup>
import Comp from './emit_from.vue';

function strFn(_: string) { }
function numFn(_: number) { }
</script>