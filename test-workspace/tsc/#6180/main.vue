<script setup lang="ts">
import { exactType } from '../shared';
import Button from './Button.vue';

type Props = InstanceType<typeof Button>['$props'];

// #6180: withDefaults + discriminated union must not collapse to Record<string, any>
exactType({} as string extends keyof Props ? true : false, false);
</script>

<template>
	<Button as="a" href="/" />
</template>
