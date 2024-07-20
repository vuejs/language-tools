<template>
	{{ loading }}
	<loading :a="str => exactType(str, {} as string)"></loading>
</template>

<script lang="ts" setup>
import { exactType } from '../../shared';
import { Loading } from './components';

let loading = false;
</script>
