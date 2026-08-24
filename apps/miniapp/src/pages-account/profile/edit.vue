<script setup lang="ts">
import { onLoad, onUnload } from "@dcloudio/uni-app";
import type { MiniappUserProfile } from "@petcare/shared-types";
import { computed, reactive, ref } from "vue";
import { isMainlandChinaMobile } from "./profile-form";
import { MiniappApiError } from "@/api/request";
import { bindPhone, getProfile, sendPhoneCode, updateProfile, uploadAvatar } from "@/api/user";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";
import { safeReturnUrl, session, updateSessionUser } from "@/state/session";

interface ChooseAvatarEvent {
  detail?: { avatarUrl?: string };
}

const profile = ref<MiniappUserProfile | null>(session.user);
const form = reactive({
  nickname: session.user?.nickname ?? "",
  region: session.user?.region ?? "",
  bio: session.user?.bio ?? "",
});
const phone = ref("");
const code = ref("");
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const sendingCode = ref(false);
const bindingPhone = ref(false);
const countdown = ref(0);
const returnUrl = ref<string | null>(null);
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const avatarUrl = computed(() => {
  const user = profile.value;

  return user ? (user.avatar ?? getDefaultAvatar(user.id)) : "/static/main/profile-cat.png";
});

function applyProfile(nextProfile: MiniappUserProfile) {
  profile.value = nextProfile;
  form.nickname = nextProfile.nickname;
  form.region = nextProfile.region ?? "";
  form.bio = nextProfile.bio ?? "";
  updateSessionUser(nextProfile);
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof MiniappApiError ? error.message : fallback;
}

async function loadProfile() {
  if (loading.value) {
    return;
  }

  loading.value = true;

  try {
    applyProfile(await getProfile());
  } catch (error) {
    await uni.showToast({ title: errorText(error, "个人资料加载失败"), icon: "none" });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (saving.value) {
    return;
  }

  const nickname = form.nickname.trim();
  const region = form.region.trim();
  const bio = form.bio.trim();

  if (!nickname || nickname.length > 24 || /\p{Cc}/u.test(nickname)) {
    await uni.showToast({ title: "昵称应为 1 至 24 个字符", icon: "none" });

    return;
  }

  if (region.length > 80 || bio.length > 200 || /\p{Cc}/u.test(region) || /\p{Cc}/u.test(bio)) {
    await uni.showToast({ title: "所在地区或个人简介过长", icon: "none" });

    return;
  }

  saving.value = true;
  let saved = false;

  try {
    applyProfile(await updateProfile({ nickname, region: region || null, bio: bio || null }));
    saved = true;
  } catch (error) {
    await uni.showToast({ title: errorText(error, "保存失败，请重试"), icon: "none" });
  } finally {
    saving.value = false;
  }

  if (saved) {
    await uni.showToast({ title: "保存成功", icon: "success" });

    try {
      await uni.navigateBack();
    } catch {
      await uni.showToast({ title: "资料已保存，请手动返回", icon: "none" });
    }
  }
}

async function uploadChosenAvatar(filePath: string) {
  if (!filePath || uploading.value) {
    return;
  }

  uploading.value = true;

  try {
    applyProfile(await uploadAvatar(filePath));
    await uni.showToast({ title: "头像已更新", icon: "success" });
  } catch (error) {
    await uni.showToast({ title: errorText(error, "头像上传失败"), icon: "none" });
  } finally {
    uploading.value = false;
  }
}

function handleChooseAvatar(event: unknown) {
  const filePath = (event as ChooseAvatarEvent).detail?.avatarUrl;

  if (filePath) {
    void uploadChosenAvatar(filePath);
  }
}

function chooseImage() {
  if (uploading.value) {
    return;
  }

  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    success(result) {
      const filePath = result.tempFilePaths[0];

      if (filePath) {
        void uploadChosenAvatar(filePath);
      }
    },
    fail(error) {
      if (!error.errMsg.includes("cancel")) {
        void uni.showToast({ title: "头像选择失败", icon: "none" });
      }
    },
  });
}

function startCountdown() {
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;

    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = undefined;
    }
  }, 1000);
}

async function requestPhoneCode() {
  if (sendingCode.value || countdown.value > 0) {
    return;
  }

  if (!isMainlandChinaMobile(phone.value)) {
    await uni.showToast({ title: "请输入正确的手机号", icon: "none" });

    return;
  }

  sendingCode.value = true;

  try {
    await sendPhoneCode(phone.value);
    startCountdown();
    await uni.showToast({ title: "验证码已发送", icon: "none" });
  } catch (error) {
    await uni.showToast({ title: errorText(error, "验证码发送失败"), icon: "none" });
  } finally {
    sendingCode.value = false;
  }
}

async function submitPhone() {
  if (bindingPhone.value) {
    return;
  }

  if (!isMainlandChinaMobile(phone.value) || !/^\d{6}$/u.test(code.value)) {
    await uni.showToast({ title: "请输入正确的手机号和验证码", icon: "none" });

    return;
  }

  bindingPhone.value = true;
  let bound = false;

  try {
    applyProfile(await bindPhone(phone.value, code.value));
    bound = true;
    await uni.showToast({ title: "手机号绑定成功", icon: "success" });
  } catch (error) {
    await uni.showToast({ title: errorText(error, "手机号绑定失败"), icon: "none" });
  } finally {
    bindingPhone.value = false;
  }

  if (bound && returnUrl.value) {
    try {
      await uni.navigateTo({ url: returnUrl.value });
    } catch {
      await uni.showToast({ title: "手机号已绑定，请手动返回", icon: "none" });
    }
  }
}

onLoad((query = {}) => {
  const candidate = query.returnUrl;

  if (typeof candidate === "string" && safeReturnUrl(candidate) === candidate) {
    returnUrl.value = candidate;
  }

  void loadProfile();
});

onUnload(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
});
</script>

<template>
  <SubPageLayout title="编辑个人信息">
    <view class="flex flex-col gap-card px-action py-card">
      <view class="flex flex-col items-center gap-sm">
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="h-avatar-lg w-avatar-lg overflow-hidden rounded-full p-0"
          :class="uploading ? 'opacity-50' : ''"
          open-type="chooseAvatar"
          :disabled="uploading"
          aria-label="选择微信头像"
          @chooseavatar="handleChooseAvatar"
        >
          <image class="h-full w-full" :src="avatarUrl" mode="aspectFill" />
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <view
          class="h-avatar-lg w-avatar-lg overflow-hidden rounded-full"
          role="button"
          aria-label="选择头像"
          :aria-disabled="uploading"
          :class="uploading ? 'opacity-50' : ''"
          @click="chooseImage"
        >
          <image class="h-full w-full" :src="avatarUrl" mode="aspectFill" />
        </view>
        <!-- #endif -->
        <text class="text-caption text-brand leading-caption">
          {{ uploading ? "正在上传…" : "更换头像" }}
        </text>
      </view>

      <view class="overflow-hidden main-card">
        <label class="flex items-center gap-action border-b border-divider px-action py-action">
          <text class="w-pet shrink-0 text-body text-muted leading-label">昵称</text>
          <!-- #ifdef MP-WEIXIN -->
          <input
            v-model="form.nickname"
            class="min-w-0 flex-1 text-right text-body text-ink"
            type="nickname"
            :maxlength="24"
            placeholder="请输入昵称"
          />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <input
            v-model="form.nickname"
            class="min-w-0 flex-1 text-right text-body text-ink"
            type="text"
            :maxlength="24"
            placeholder="请输入昵称"
          />
          <!-- #endif -->
        </label>
        <label class="flex items-center gap-action border-b border-divider px-action py-action">
          <text class="w-pet shrink-0 text-body text-muted leading-label">所在地区</text>
          <input
            v-model="form.region"
            class="min-w-0 flex-1 text-right text-body text-ink"
            type="text"
            :maxlength="80"
            placeholder="请输入所在地区"
          />
        </label>
        <label class="flex items-start gap-action px-action py-action">
          <text class="w-pet shrink-0 text-body text-muted leading-label">个人简介</text>
          <textarea
            v-model="form.bio"
            class="min-h-control min-w-0 flex-1 text-right text-body text-ink"
            :maxlength="200"
            placeholder="介绍一下自己"
          />
        </label>
      </view>

      <view
        v-if="profile && profile.phoneMasked === null"
        class="flex flex-col gap-copy main-card p-action"
      >
        <view>
          <text class="section-heading">完善手机号</text>
          <text class="mt-caption block quiet-text">发布等操作前需通过短信验证手机号</text>
        </view>
        <input
          v-model="phone"
          class="h-control rounded-control bg-divider px-copy text-body text-ink"
          type="number"
          :maxlength="11"
          placeholder="请输入手机号"
        />
        <view class="flex gap-sm">
          <input
            v-model="code"
            class="h-control min-w-0 flex-1 rounded-control bg-divider px-copy text-body text-ink"
            type="number"
            :maxlength="6"
            placeholder="请输入验证码"
          />
          <button
            class="h-control shrink-0 border border-brand rounded-control bg-surface px-copy text-caption text-brand"
            :class="sendingCode || countdown > 0 ? 'opacity-50' : ''"
            :disabled="sendingCode || countdown > 0"
            @click="requestPhoneCode"
          >
            {{ countdown > 0 ? `${countdown}s 后重试` : sendingCode ? "发送中…" : "获取验证码" }}
          </button>
        </view>
        <button
          class="h-button rounded-control bg-brand text-button text-surface font-semibold"
          :class="bindingPhone ? 'opacity-50' : ''"
          :disabled="bindingPhone"
          @click="submitPhone"
        >
          {{ bindingPhone ? "验证中…" : "验证并绑定" }}
        </button>
      </view>

      <view v-else-if="profile" class="flex items-center justify-between main-card p-action">
        <text class="text-body text-muted leading-label">已绑定手机号</text>
        <text class="text-body text-ink leading-label">{{ profile.phoneMasked }}</text>
      </view>
    </view>

    <template #actions>
      <button
        class="h-button flex items-center justify-center rounded-control bg-brand"
        :class="saving || loading || !profile ? 'opacity-50' : ''"
        :disabled="saving || loading || !profile"
        @click="save"
      >
        <text class="text-button text-surface font-semibold leading-button">{{
          saving ? "保存中…" : "保存修改"
        }}</text>
      </button>
    </template>
  </SubPageLayout>
</template>
