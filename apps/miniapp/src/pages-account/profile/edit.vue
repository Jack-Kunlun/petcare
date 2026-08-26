<script setup lang="ts">
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { MINIAPP_ACCOUNT_ERROR_CODE } from "@petcare/shared-types";
import type { MiniappUserProfile } from "@petcare/shared-types";
import { computed, reactive, ref } from "vue";
import { isMainlandChinaMobile, isProfileFormDirty, mergeProfileResponse } from "./profile-form";
import ProfileField from "./ProfileField.vue";
import { MiniappApiError } from "@/api/request";
import { bindPhone, getProfile, sendPhoneCode, updateProfile, uploadAvatar } from "@/api/user";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { miniappDesignTokens } from "@/config/design-tokens";
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
const persistedForm = ref({ ...form });
const phone = ref("");
const code = ref("");
const phoneError = ref("");
const codeError = ref("");
const phoneSheetOpen = ref(false);
const codeSent = ref(false);
const busy = ref<"load" | "avatar" | "save" | "code" | "bind" | null>(null);
const loadError = ref("");
const countdown = ref(0);
const returnUrl = ref<string | null>(null);
let countdownTimer: ReturnType<typeof setInterval> | undefined;

const avatarUrl = computed(() => {
  const user = profile.value;

  return user ? (user.avatar ?? getDefaultAvatar(user.id)) : "/static/main/profile-cat.png";
});
const hasProfileChanges = computed(() => isProfileFormDirty(form, persistedForm.value));
const saveDisabled = computed(
  () => busy.value !== null || !profile.value || !hasProfileChanges.value,
);
const phoneCodeDisabled = computed(() => busy.value !== null || countdown.value > 0);
const phoneInputDisabled = computed(() => busy.value !== null || countdown.value > 0);
const primaryButtonStyle = {
  backgroundColor: miniappDesignTokens.colors.brand,
  color: miniappDesignTokens.colors.surface,
};
const phoneCodeButtonText = computed(() => {
  if (busy.value === "code") {
    return "发送中…";
  }

  if (countdown.value > 0) {
    return `${countdown.value}s`;
  }

  return codeSent.value ? "重新获取" : "获取验证码";
});

function errorText(error: unknown, fallback: string): string {
  return error instanceof MiniappApiError ? error.message : fallback;
}

function syncEditableProfile(user: MiniappUserProfile) {
  form.nickname = user.nickname;
  form.region = user.region ?? "";
  form.bio = user.bio ?? "";
  persistedForm.value = { ...form };
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
      syncEditableProfile(response);
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
  if (saveDisabled.value || !profile.value) {
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
      syncEditableProfile(response);
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

function clearCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = undefined;
  }

  countdown.value = 0;
}

function startCountdown() {
  clearCountdown();
  countdown.value = 60;
  codeSent.value = true;
  countdownTimer = setInterval(() => {
    countdown.value -= 1;

    if (countdown.value <= 0) {
      clearCountdown();
    }
  }, 1000);
}

function resetPhoneBindingForm() {
  clearCountdown();
  phone.value = "";
  code.value = "";
  phoneError.value = "";
  codeError.value = "";
  codeSent.value = false;
}

function openPhoneSheet() {
  if (busy.value !== null || profile.value?.phoneMasked !== null) {
    return;
  }

  resetPhoneBindingForm();
  phoneSheetOpen.value = true;
}

function closePhoneSheet() {
  if (busy.value !== null) {
    return;
  }

  phoneSheetOpen.value = false;
  resetPhoneBindingForm();
}

function clearPhoneError() {
  phoneError.value = "";
}

function clearCodeError() {
  codeError.value = "";
}

function validatePhone(): boolean {
  const value = phone.value.trim();

  phone.value = value;

  if (!value) {
    phoneError.value = "请输入手机号";

    return false;
  }

  if (!isMainlandChinaMobile(value)) {
    phoneError.value = "请输入正确的手机号";

    return false;
  }

  phoneError.value = "";

  return true;
}

function validateCode(): boolean {
  const value = code.value.trim();

  code.value = value;

  if (!value) {
    codeError.value = "请输入验证码";

    return false;
  }

  if (!/^\d{6}$/u.test(value)) {
    codeError.value = "请输入 6 位验证码";

    return false;
  }

  codeError.value = "";

  return true;
}

function setPhoneRequestError(error: unknown) {
  phoneError.value =
    error instanceof MiniappApiError && error.code === "NETWORK_ERROR"
      ? "网络异常，请检查网络后重试"
      : errorText(error, "验证码发送失败，请重试");
}

function setPhoneBindingError(error: unknown) {
  if (
    error instanceof MiniappApiError &&
    (error.code === MINIAPP_ACCOUNT_ERROR_CODE.PHONE_CONFLICT ||
      error.code === MINIAPP_ACCOUNT_ERROR_CODE.PHONE_ALREADY_BOUND)
  ) {
    phoneError.value = error.message;

    return;
  }

  codeError.value =
    error instanceof MiniappApiError && error.code === "NETWORK_ERROR"
      ? "网络异常，请检查网络后重试"
      : errorText(error, "验证失败，请重试");
}

async function requestPhoneCode() {
  if (busy.value !== null || countdown.value > 0 || !validatePhone()) {
    return;
  }

  busy.value = "code";

  try {
    await sendPhoneCode(phone.value);
    startCountdown();
    await uni.showToast({ title: "验证码已发送", icon: "none" });
  } catch (error) {
    setPhoneRequestError(error);
  } finally {
    busy.value = null;
  }
}

async function submitPhone() {
  if (busy.value !== null || !profile.value) {
    return;
  }

  const phoneValid = validatePhone();
  const codeValid = validateCode();

  if (!phoneValid || !codeValid) {
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
    }
  } catch (error) {
    setPhoneBindingError(error);
  } finally {
    busy.value = null;
  }

  if (!bound) {
    return;
  }

  phoneSheetOpen.value = false;
  resetPhoneBindingForm();
  await uni.showToast({ title: "手机号绑定成功", icon: "success" });

  if (returnUrl.value) {
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
  clearCountdown();
});
</script>

<template>
  <SubPageLayout title="编辑个人信息">
    <view class="min-h-full bg-surface px-action py-card">
      <view v-if="loadError && !profile" class="flex flex-col items-center gap-copy py-section">
        <text class="text-caption text-danger leading-caption">{{ loadError }}</text>
        <button
          class="h-control rounded-control bg-brand px-action text-surface"
          :class="busy !== null ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
          :style="primaryButtonStyle"
          :disabled="busy !== null"
          :aria-disabled="busy !== null"
          @click="loadProfile"
        >
          重试
        </button>
      </view>
      <view v-else-if="!profile" class="flex items-center justify-center py-section">
        <text class="text-body text-muted leading-body">正在加载个人资料…</text>
      </view>

      <template v-if="profile">
        <view class="flex justify-center pb-screen pt-sm">
          <!-- #ifdef MP-WEIXIN -->
          <button
            class="flex flex-col items-center gap-sm bg-transparent p-0"
            :class="busy !== null ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
            style="margin: 0; border: none; background: transparent"
            open-type="chooseAvatar"
            :disabled="busy !== null"
            :aria-disabled="busy !== null"
            aria-label="选择微信头像"
            hover-class="opacity-70"
            @chooseavatar="handleChooseAvatar"
          >
            <image class="h-pet w-pet rounded-full" :src="avatarUrl" mode="aspectFill" />
            <text class="text-caption text-brand leading-caption">
              {{ busy === "avatar" ? "正在上传…" : "更换头像" }}
            </text>
          </button>
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <button
            class="flex flex-col items-center gap-sm bg-transparent p-0"
            :class="busy !== null ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
            style="margin: 0; border: none; background: transparent"
            aria-label="选择头像"
            :disabled="busy !== null"
            :aria-disabled="busy !== null"
            hover-class="opacity-70"
            @click="chooseImage"
          >
            <image class="h-pet w-pet rounded-full" :src="avatarUrl" mode="aspectFill" />
            <text class="text-caption text-brand leading-caption">
              {{ busy === "avatar" ? "正在上传…" : "更换头像" }}
            </text>
          </button>
          <!-- #endif -->
        </view>

        <view class="border-t border-divider">
          <ProfileField label="昵称" required :disabled="busy !== null">
            <template #control>
              <!-- #ifdef MP-WEIXIN -->
              <input
                v-model="form.nickname"
                class="h-control min-w-0 flex-1 text-right text-body text-ink leading-body"
                type="nickname"
                :maxlength="24"
                :disabled="busy !== null"
                aria-label="昵称"
                placeholder="请输入昵称"
              />
              <!-- #endif -->
              <!-- #ifndef MP-WEIXIN -->
              <input
                v-model="form.nickname"
                class="h-control min-w-0 flex-1 text-right text-body text-ink leading-body"
                type="text"
                :maxlength="24"
                :disabled="busy !== null"
                aria-label="昵称"
                placeholder="请输入昵称"
              />
              <!-- #endif -->
            </template>
          </ProfileField>

          <ProfileField
            label="手机号"
            :value="profile.phoneMasked ?? '绑定手机号'"
            :clickable="profile.phoneMasked === null"
            :disabled="busy !== null"
            :right-icon="profile.phoneMasked === null ? '/static/main/chevron.svg' : ''"
            @click="openPhoneSheet"
          />

          <ProfileField label="所在地区" :disabled="busy !== null">
            <template #control>
              <input
                v-model="form.region"
                class="h-control min-w-0 flex-1 text-right text-body text-ink leading-body"
                type="text"
                :maxlength="80"
                :disabled="busy !== null"
                aria-label="所在地区"
                placeholder="请输入所在地区"
              />
            </template>
          </ProfileField>

          <ProfileField label="个人简介" :disabled="busy !== null">
            <template #control>
              <textarea
                v-model="form.bio"
                class="min-h-control min-w-0 flex-1 text-right text-body text-ink leading-body"
                auto-height
                :maxlength="200"
                :disabled="busy !== null"
                aria-label="个人简介"
                placeholder="介绍一下自己"
              />
            </template>
          </ProfileField>
        </view>
      </template>
    </view>

    <wd-popup
      v-model="phoneSheetOpen"
      position="bottom"
      round
      root-portal
      safe-area-inset-bottom
      custom-class="bg-surface"
      :close-on-click-modal="busy === null"
      @close="resetPhoneBindingForm"
    >
      <view
        class="bg-surface px-action pb-action pt-card"
        role="dialog"
        aria-modal="true"
        aria-label="绑定手机号"
      >
        <view class="h-control flex items-center justify-between">
          <text class="section-heading">绑定手机号</text>
          <button
            class="h-control w-control flex items-center justify-center bg-transparent p-0"
            :class="busy !== null ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
            style="margin: 0; border: none; background: transparent"
            :disabled="busy !== null"
            :aria-disabled="busy !== null"
            aria-label="关闭手机号绑定"
            hover-class="opacity-60"
            @click="closePhoneSheet"
          >
            <wd-icon
              name="close"
              :size="miniappDesignTokens.sizes['icon-sm']"
              custom-class="text-muted"
            />
          </button>
        </view>

        <view class="mt-action flex flex-col gap-action">
          <label>
            <text class="mb-sm block text-body text-ink leading-label">手机号</text>
            <input
              v-model="phone"
              class="box-border h-control w-full rounded-control bg-page-bg px-copy text-body text-ink"
              :class="phoneInputDisabled ? 'opacity-50' : ''"
              type="number"
              :maxlength="11"
              :disabled="phoneInputDisabled"
              aria-label="手机号"
              :aria-invalid="Boolean(phoneError)"
              aria-describedby="phone-error"
              placeholder="请输入手机号"
              @input="clearPhoneError"
              @blur="validatePhone"
            />
            <text
              v-if="phoneError"
              id="phone-error"
              class="mt-caption block text-caption text-danger leading-caption"
              role="alert"
            >
              {{ phoneError }}
            </text>
          </label>

          <label>
            <text class="mb-sm block text-body text-ink leading-label">验证码</text>
            <view
              class="h-control flex items-center overflow-hidden rounded-control bg-page-bg pl-copy"
              :class="busy !== null ? 'opacity-50' : ''"
            >
              <input
                v-model="code"
                class="h-full min-w-0 flex-1 bg-transparent text-body text-ink"
                type="number"
                :maxlength="6"
                :disabled="busy !== null"
                aria-label="验证码"
                :aria-invalid="Boolean(codeError)"
                aria-describedby="code-error"
                placeholder="请输入验证码"
                @input="clearCodeError"
                @blur="validateCode"
              />
              <button
                class="h-control min-w-pet shrink-0 bg-transparent px-copy text-caption"
                :class="
                  phoneCodeDisabled ? 'cursor-not-allowed text-subtle' : 'cursor-pointer text-brand'
                "
                style="margin: 0; border: none; background: transparent"
                :disabled="phoneCodeDisabled"
                :aria-disabled="phoneCodeDisabled"
                aria-live="polite"
                @click="requestPhoneCode"
              >
                {{ phoneCodeButtonText }}
              </button>
            </view>
            <text
              v-if="codeError"
              id="code-error"
              class="mt-caption block text-caption text-danger leading-caption"
              role="alert"
            >
              {{ codeError }}
            </text>
          </label>

          <button
            class="h-control flex items-center justify-center rounded-control bg-brand text-button text-surface font-semibold"
            :class="busy !== null ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
            :style="primaryButtonStyle"
            :disabled="busy !== null"
            :aria-disabled="busy !== null"
            @click="submitPhone"
          >
            {{ busy === "bind" ? "验证中…" : "确认绑定" }}
          </button>
        </view>
      </view>
    </wd-popup>

    <template #actions>
      <button
        class="h-control flex items-center justify-center rounded-control bg-brand"
        :class="saveDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'"
        :style="primaryButtonStyle"
        :disabled="saveDisabled"
        :aria-disabled="saveDisabled"
        @click="save"
      >
        <text class="text-button text-surface font-semibold leading-button">
          {{ busy === "save" ? "保存中…" : "保存修改" }}
        </text>
      </button>
    </template>
  </SubPageLayout>
</template>
