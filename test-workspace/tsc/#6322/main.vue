<script setup lang="ts">
import { reactive } from 'vue';
import Child from './child.vue';

const form = reactive({ first: '', second: '' });
</script>

<template>
	<Child base="https://example.com/" v-model="form.first" />
	<Child :base="`https://${'example.com'}/`" v-model="form.second" />
	<Child :base="/https:\/\//.source" v-model="form.second" />
	<Child v-model="form.second" />
</template>
