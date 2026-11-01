<script lang="ts" setup>
import { useCssModule } from 'vue';
import { exactType } from '../shared';

const style = useCssModule();
exactType(style, {} as Record<string, string> & {
	a: string;
});

const namedModule = useCssModule('named');
exactType(namedModule, {} as Record<string, string> & {
	b: string;
});
</script>

<template>
	<div :class="[$style.a, named.b]"></div>
</template>

<style module src="./a.module.css"></style>

<style module="named" src="./b.module.css"></style>
