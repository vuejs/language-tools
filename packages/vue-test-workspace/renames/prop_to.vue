<template>
	<Comp :foo-bar="'foo'"></Comp>
	<Comp :fooBar="'foo'"></Comp>
</template>

<script lang="ts" setup>
import Comp from './prop_from.vue';
</script>