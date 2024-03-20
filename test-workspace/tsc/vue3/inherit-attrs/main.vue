<script setup	lang="ts">
import { exactType } from '../../shared';
import basic from './basic.vue';
</script>

<template>
	<basic @foo="s => exactType(s, '' as string)">
		<div></div>
	</basic>
</template>