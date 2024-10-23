<script setup lang="ts">
import { exactType } from '../../shared';
import basic from './basic.vue';
import inheritAttrsFalse from './inherit-attrs-false.vue';
import defineOptionsInheritAttrsFalse from './define-options-inherit-attrs-false.vue';
import inheritAttrsFalseVBind from './inherit-attrs-false-v-bind.vue';
</script>

<template>
	<basic bar="foo" @foo="s => exactType(s, '' as string)" />
	<!-- @vue-expect-error -->
	<inheritAttrsFalse bar="1" />
	<!-- @vue-expect-error -->
	<defineOptionsInheritAttrsFalse bar="1" />
	<inheritAttrsFalseVBind bar="1" />
</template>
