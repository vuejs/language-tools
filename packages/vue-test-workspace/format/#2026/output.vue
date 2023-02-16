<template>
	<span :class="['class1', 'class2', { 'class3': !modelValue }]">{{
		$i18n('i18n-key') }}</span>
</template>
