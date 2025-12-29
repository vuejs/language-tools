<script lang="tsx">
/// <reference types="vue/jsx" />

import { exactType } from '../shared';
import Child from './child.vue';
import Generic from './generic.vue';

(<Child>
	{{ activator: props => exactType(props.isActive, {} as boolean) }}
</Child>);
(<Generic>
	{{ activator: props => exactType(props.isActive, {} as boolean) }}
</Generic>);
</script>

<script setup lang="tsx"></script>

<template>
	<Child></Child>
	<Generic></Generic>
</template>
