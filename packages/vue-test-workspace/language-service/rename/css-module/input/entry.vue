<template>
    <div :class="$style.foo"></div>
                   <!-- ^^^rename: bar -->
</template>

<style module>
/* .foo { } */
.foo { }
</style>

<style module lang="scss">
// .foo { }
</style>