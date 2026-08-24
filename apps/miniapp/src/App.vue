<script setup lang="ts">
import { bootstrapSession } from "@/state/session";

onLaunch(() => {
  void bootstrapSession();
});
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
