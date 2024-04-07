<template>
	<div>
	  <!-- @vue-ignore -->
	  <div :foo="foo">
		<!-- @vue-expect-error -->
		{{ foo }}
	  </div>
	  <!-- @vue-expect-error -->
	  <div :foo="foo">
		<!-- @vue-expect-error -->
		{{ foo }}
	  </div>
	  <!-- @vue-skip -->
	  <div :foo="foo">
		{{ foo }}
	  </div>
  
	  <!-- @vue-ignore -->
	  {{ foo }}
	  <!-- @vue-expect-error -->
	  {{ foo }}
	  <!-- @vue-skip -->
	  {{ foo }}
  
	  <!-- @vue-ignore -->
	  {{ foo }} {{ foo }}
	  <!-- @vue-expect-error -->
	  {{ foo }} {{ foo }}
	  <!-- @vue-skip -->
	  {{ foo }} {{ foo }}
	</div>
  </template>
  