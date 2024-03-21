<script setup	lang="ts">
import { exactType } from '../../shared';
import basic from './basic.vue';
import inheritAttrsFalse from 'tsc/vue3_strictTemplate/inherit-attrs/inherit-attrs-false.vue';
import defineOptionsInheritAttrsFalse from 'tsc/vue3_strictTemplate/inherit-attrs/define-options-inherit-attrs-false.vue';
import inheritAttrsFalseVBind from 'tsc/vue3_strictTemplate/inherit-attrs/inherit-attrs-false-v-bind.vue';
</script>

<template>
	<basic bar="foo" @foo="s => exactType(s, '' as string)" />
	<!-- @vue-expect-error -->
	<inheritAttrsFalse bar="1" />
	<!-- @vue-expect-error -->
	<defineOptionsInheritAttrsFalse bar="1" />
	<inheritAttrsFalseVBind bar="1" />
</template>