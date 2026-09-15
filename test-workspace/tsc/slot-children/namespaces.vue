<script setup lang="ts">
import Shadow from './Shadow.vue';
import OptionsShadow from './OptionsShadow.vue';
import ScriptSrc from './ScriptSrc.vue';
import NoExport from './NoExport.vue';
import JavaScript from './JavaScript.vue';
import SameShape from './SameShape.vue';
import SvgHolder from './SvgHolder.vue';
import NativeWrapper from './NativeWrapper.vue';
import OptionsWrapper from './OptionsWrapper.vue';
import Basic from './Basic.vue';
</script>
<template>
	<Basic>
		<Shadow />
		<OptionsShadow />
	</Basic>
	<Basic>
		<template #input>
			<ScriptSrc />
		</template>
	</Basic>
	<Basic>
		<template #input>
			<NoExport />
		</template>
	</Basic>
	<Basic>
		<template #input>
			<JavaScript />
		</template>
	</Basic>
	<!-- @vue-expect-error -->
	<Basic>
		<SameShape :value="1" />
	</Basic>
	<svg>
		<SvgHolder>
			<a />
		</SvgHolder>
	</svg>
	<!-- @vue-expect-error -->
	<SvgHolder>
		<a />
	</SvgHolder>
	<Basic>
		<OptionsWrapper />
	</Basic>
	<Basic>
		<template #input>
			<NativeWrapper />
		</template>
	</Basic>
</template>
