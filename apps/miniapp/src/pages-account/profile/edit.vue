<script setup lang="ts">
import { onLoad, onUnload } from "@dcloudio/uni-app";
import type { MiniappUserProfile } from "@petcare/shared-types";
import { computed, reactive, ref } from "vue";
import { isMainlandChinaMobile, mergeProfileResponse } from "./profile-form";
import { MiniappApiError } from "@/api/request";
import { bindPhone, getProfile, sendPhoneCode, updateProfile, uploadAvatar } from "@/api/user";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { getDefaultAvatar } from "@/state/default-avatar";
import {
  captureSessionUserRevision,
  parseReturnUrl,
  session,
  updateSessionUser,
} from "@/state/session";

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
const busy = ref<"load" | "avatar" | "save" | "code" | "bind" | null>(null);
const loadError = ref("");
const countdown = ref(0);
const returnUrl = ref<string | null>(null);
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const avatarUrl = computed(() => {
  const user = profile.value;

  return user ? (user.avatar ?? getDefaultAvatar(user.id)) : "/static/main/profile-cat.png";
});

function errorText(error: unknown, fallback: string): string {
  return error instanceof MiniappApiError ? error.message : fallback;
}

async function loadProfile() {
  if (busy.value !== null) {
    return;
  }

  busy.value = "load";
  loadError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getProfile();

    if (updateSessionUser(response, startedAt)) {
      profile.value = response;
      form.nickname = response.nickname;
      form.region = response.region ?? "";
      form.bio = response.bio ?? "";
    } else {
      profile.value = session.user;
    }
  } catch (error) {
    if (profile.value) {
      await uni.showToast({ title: errorText(error, "个人资料加载失败"), icon: "none" });
    } else {
      loadError.value = errorText(error, "个人资料加载失败，请重试");
    }
  } finally {
    busy.value = null;
  }
}

async function save() {
  if (busy.value !== null || !profile.value) {
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

  busy.value = "save";
  const startedAt = captureSessionUserRevision();
  let saved = false;

  try {
    const response = await updateProfile({ nickname, region: region || null, bio: bio || null });

    if (updateSessionUser(response, startedAt)) {
      profile.value = mergeProfileResponse(profile.value, response, "save");
      form.nickname = response.nickname;
      form.region = response.region ?? "";
      form.bio = response.bio ?? "";
      saved = true;
    }
  } catch (error) {
    await uni.showToast({ title: errorText(error, "保存失败，请重试"), icon: "none" });
  } finally {
    busy.value = null;
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

async function uploadChosenAvatar(
  filePath: string,
  startedAt = captureSessionUserRevision(),
  ownsBusy = false,
) {
  if (!filePath || (!ownsBusy && busy.value !== null) || !profile.value) {
    if (ownsBusy) {
      busy.value = null;
    }

    return;
  }

  if (!ownsBusy) {
    busy.value = "avatar";
  }

  try {
    const response = await uploadAvatar(filePath);

    if (updateSessionUser(response, startedAt)) {
      profile.value = mergeProfileResponse(profile.value, response, "avatar");
      await uni.showToast({ title: "头像已更新", icon: "success" });
    }
  } catch (error) {
    await uni.showToast({ title: errorText(error, "头像上传失败"), icon: "none" });
  } finally {
    busy.value = null;
  }
}

function handleChooseAvatar(event: unknown) {
  const filePath = (event as ChooseAvatarEvent).detail?.avatarUrl;

  if (filePath) {
    void uploadChosenAvatar(filePath);
  }
}

function chooseImage() {
  if (busy.value !== null) {
    return;
  }

  busy.value = "avatar";
  const startedAt = captureSessionUserRevision();

  uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    success(result) {
      const filePath = result.tempFilePaths[0];

      if (filePath) {
        void uploadChosenAvatar(filePath, startedAt, true);
      } else {
        busy.value = null;
      }
    },
    fail(error) {
      busy.value = null;

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
  if (busy.value !== null || countdown.value > 0) {
    return;
  }

  if (!isMainlandChinaMobile(phone.value)) {
    await uni.showToast({ title: "请输入正确的手机号", icon: "none" });

    return;
  }

  busy.value = "code";

  try {
    await sendPhoneCode(phone.value);
    startCountdown();
    await uni.showToast({ title: "验证码已发送", icon: "none" });
  } catch (error) {
    await uni.showToast({ title: errorText(error, "验证码发送失败"), icon: "none" });
  } finally {
    busy.value = null;
  }
}

async function submitPhone() {
  if (busy.value !== null || !profile.value) {
    return;
  }

  if (!isMainlandChinaMobile(phone.value) || !/^\d{6}$/u.test(code.value)) {
    await uni.showToast({ title: "请输入正确的手机号和验证码", icon: "none" });

    return;
  }

  busy.value = "bind";
  const startedAt = captureSessionUserRevision();
  let bound = false;

  try {
    const response = await bindPhone(phone.value, code.value);

    if (updateSessionUser(response, startedAt)) {
      profile.value = mergeProfileResponse(profile.value, response, "bind");
      bound = true;
      await uni.showToast({ title: "手机号绑定成功", icon: "success" });
    }
  } catch (error) {
    await uni.showToast({ title: errorText(error, "手机号绑定失败"), icon: "none" });
  } finally {
    busy.value = null;
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

  if (typeof candidate === "string") {
    returnUrl.value = parseReturnUrl(candidate);
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
      <view
        v-if="loadError && !profile"
        class="flex flex-col items-center gap-copy main-card p-card"
      >
        <text class="text-caption text-danger leading-caption">{{ loadError }}</text>
        <button
          class="h-control rounded-control bg-brand px-action text-surface"
          :class="busy !== null ? 'opacity-50' : ''"
          :disabled="busy !== null"
          :aria-disabled="busy !== null"
          @click="loadProfile"
        >
          重试
        </button>
      </view>
      <view v-else-if="!profile" class="flex items-center justify-center main-card p-card">
        <text class="text-body text-muted leading-body">正在加载个人资料…</text>
      </view>

      <view v-if="profile" class="flex flex-col items-center gap-sm">
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="h-avatar-lg w-avatar-lg overflow-hidden rounded-full p-0"
          :class="busy !== null ? 'opacity-50' : ''"
          open-type="chooseAvatar"
          :disabled="busy !== null"
          :aria-disabled="busy !== null"
          aria-label="选择微信头像"
          @chooseavatar="handleChooseAvatar"
        >
          <image class="h-full w-full" :src="avatarUrl" mode="aspectFill" />
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button
          class="h-avatar-lg w-avatar-lg overflow-hidden rounded-full"
          style="margin: 0; padding: 0; border: none; background: transparent"
          aria-label="选择头像"
          :disabled="busy !== null"
          :aria-disabled="busy !== null"
          :class="busy !== null ? 'opacity-50' : ''"
          hover-class="none"
          @click="chooseImage"
        >
          <image class="h-full w-full" :src="avatarUrl" mode="aspectFill" />
        </button>
        <!-- #endif -->
        <text class="text-caption text-brand leading-caption">
          {{ busy === "avatar" ? "正在上传…" : "更换头像" }}
        </text>
      </view>

      <view
        v-if="profile"
        class="overflow-hidden main-card"
        :class="busy !== null ? 'opacity-50' : ''"
      >
        <label class="flex items-center gap-action border-b border-divider px-action py-action">
          <text class="w-pet shrink-0 text-body text-muted leading-label">昵称</text>
          <!-- #ifdef MP-WEIXIN -->
          <input
            v-model="form.nickname"
            class="min-w-0 flex-1 text-right text-body text-ink"
            type="nickname"
            :maxlength="24"
            :disabled="busy !== null"
            placeholder="请输入昵称"
          />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <input
            v-model="form.nickname"
            class="min-w-0 flex-1 text-right text-body text-ink"
            type="text"
            :maxlength="24"
            :disabled="busy !== null"
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
            :disabled="busy !== null"
            placeholder="请输入所在地区"
          />
        </label>
        <label class="flex items-start gap-action px-action py-action">
          <text class="w-pet shrink-0 text-body text-muted leading-label">个人简介</text>
          <textarea
            v-model="form.bio"
            class="min-h-control min-w-0 flex-1 text-right text-body text-ink"
            :maxlength="200"
            :disabled="busy !== null"
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
          :class="busy !== null || countdown > 0 ? 'opacity-50' : ''"
          :disabled="busy !== null || countdown > 0"
          placeholder="请输入手机号"
        />
        <view class="flex gap-sm">
          <input
            v-model="code"
            class="h-control min-w-0 flex-1 rounded-control bg-divider px-copy text-body text-ink"
            type="number"
            :maxlength="6"
            :class="busy !== null ? 'opacity-50' : ''"
            :disabled="busy !== null"
            placeholder="请输入验证码"
          />
          <button
            class="h-control shrink-0 border border-brand rounded-control bg-surface px-copy text-caption text-brand"
            :class="busy !== null || countdown > 0 ? 'opacity-50' : ''"
            :disabled="busy !== null || countdown > 0"
            :aria-disabled="busy !== null || countdown > 0"
            @click="requestPhoneCode"
          >
            {{
              countdown > 0 ? `${countdown}s 后重试` : busy === "code" ? "发送中…" : "获取验证码"
            }}
          </button>
        </view>
        <button
          class="h-button rounded-control bg-brand text-button text-surface font-semibold"
          :class="busy !== null ? 'opacity-50' : ''"
          :disabled="busy !== null"
          :aria-disabled="busy !== null"
          @click="submitPhone"
        >
          {{ busy === "bind" ? "验证中…" : "验证并绑定" }}
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
        :class="busy !== null || !profile ? 'opacity-50' : ''"
        :disabled="busy !== null || !profile"
        :aria-disabled="busy !== null || !profile"
        @click="save"
      >
        <text class="text-button text-surface font-semibold leading-button">{{
          busy === "save" ? "保存中…" : "保存修改"
        }}</text>
      </button>
    </template>
  </SubPageLayout>
</template>
