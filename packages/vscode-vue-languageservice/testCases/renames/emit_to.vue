<template>
	<Comp @foo-bar="'ignore'"></Comp>
	<Comp @fooBar="'ignore'"></Comp>
</template>

<script lang="ts" setup>
import Comp from './emit_from.vue';
</script>