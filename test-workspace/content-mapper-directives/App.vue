<template>
	<!-- @vue-ignore -->
	<div :id="ignoredError">
		{{ childError }}
	</div>

	<!-- @vue-expect-error -->
	<div
		:id="expectedError"
		:title="expectedTitleError"
	></div>

	<!-- @vue-expect-error -->
	<div id="valid"></div>

	<!-- @vue-expect-error -->
	<div>{{ childExpectedError }}</div>

	<!-- @vue-ignore -->
	<!-- @vue-expect-error -->
	<div :id="mixedIgnoredError"></div>

	<!-- @vue-expect-error -->
	<!-- @vue-ignore -->
	<div :id="reverseMixedIgnoredError"></div>
</template>
