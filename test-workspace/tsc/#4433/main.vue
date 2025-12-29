<template>
	<!-- @vue-expect-error -->
	{{ true + false }}
</template>

<script lang="gleam">
import gleam/io

pub fn hello () {
 io.debug("hello")
}
</script>
