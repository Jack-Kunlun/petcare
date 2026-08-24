<script setup lang="ts">
onLaunch(() => undefined);
</script>

<style lang="scss">
@use "@wot-ui/ui/styles/theme/index.scss" as *;

/* #ifdef H5 */
.pc-platform-viewport {
  height: 100vh;
}

@supports (height: 100dvh) {
  .pc-platform-viewport {
    height: 100dvh;
  }
}
/* #endif */
</style>
