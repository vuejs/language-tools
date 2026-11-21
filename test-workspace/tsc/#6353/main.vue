<script setup lang="ts">
import { exactType } from '../shared';
import JavaScriptPanel from './panel-js.vue';
import Panel from './panel.vue';
import ShadowedUtility from './shadowed-utility.vue';

exactType({} as InstanceType<typeof Panel>['$props']['panelId'], {} as string);
exactType({} as InstanceType<typeof JavaScriptPanel>['$props']['panelId'], {} as string);
exactType({} as InstanceType<typeof ShadowedUtility>['$props']['panelId'], {} as string);
</script>

<template>
	<Panel panel-id="some-panel" />
	<!-- @vue-expect-error -->
	<Panel />
	<!-- @vue-expect-error -->
	<Panel :panel-id="1" />
	<JavaScriptPanel panel-id="some-panel" />
	<!-- @vue-expect-error -->
	<JavaScriptPanel />
	<!-- @vue-expect-error -->
	<JavaScriptPanel :panel-id="1" />
	<ShadowedUtility panel-id="some-panel" />
</template>
