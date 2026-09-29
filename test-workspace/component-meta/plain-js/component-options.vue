<script>
export default {
  props: {
    foo: {
      type: String,
      required: true
    }
  },
  emits: ['change']
};
</script>

<template>
  <slot name="header" :count="1" />
</template>
