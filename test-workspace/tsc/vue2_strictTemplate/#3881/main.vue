<template>
  <div>
    <transition>
      <span v-show="true">foo</span>
    </transition>
    <Transition>
      <span v-show="true">foo</span>
    </Transition>
  </div>
</template>
