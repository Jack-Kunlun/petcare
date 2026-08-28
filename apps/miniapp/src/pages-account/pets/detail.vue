<script setup lang="ts">
import { onLoad, onShow } from "@dcloudio/uni-app";
import { PET_GENDER_LABELS, PET_SPECIES_LABELS } from "@petcare/shared-types";
import type { MyPetDetail } from "@petcare/shared-types";
import { computed, ref, watch } from "vue";
import { deletePet, getMyPet } from "@/api/pets";
import { getSafeRequestErrorMessage, MiniappApiError } from "@/api/request";
import PcButton from "@/components/PcButton.vue";
import PcStatePanel from "@/components/PcStatePanel.vue";
import SubPageLayout from "@/components/SubPageLayout.vue";
import { miniappDesignTokens } from "@/config/design-tokens";
import { formatPetAge, formatPetBirthDate, petCoverImage } from "@/domain/pet-display";
import { captureSessionUserRevision, isSessionUserRevisionCurrent, session } from "@/state/session";

const petId = ref("");
const pet = ref<MyPetDetail | null>(null);
const status = ref<"loading" | "ready" | "error" | "unavailable" | "unauthenticated">("loading");
const loading = ref(false);
const deleting = ref(false);
const deleteError = ref("");
let skipInitialShow = true;

const facts = computed(() => {
  const value = pet.value;

  return value
    ? [
        { label: "种类", value: PET_SPECIES_LABELS[value.species] },
        { label: "性别", value: PET_GENDER_LABELS[value.gender] },
        { label: "生日", value: formatPetBirthDate(value.birthDate) },
        { label: "年龄", value: formatPetAge(value.birthDate) },
        { label: "体重", value: value.weightKg === null ? "未填写" : `${value.weightKg} kg` },
        { label: "绝育", value: value.sterilized ? "已绝育" : "未绝育" },
      ]
    : [];
});

function errorMessage(error: unknown, fallback: string): string {
  return getSafeRequestErrorMessage(error, fallback);
}

async function loadPet(): Promise<void> {
  if (!session.user) {
    pet.value = null;
    status.value = session.bootstrapped ? "unauthenticated" : "loading";

    return;
  }

  if (!petId.value || loading.value || deleting.value) {
    return;
  }

  loading.value = true;
  status.value = "loading";
  deleteError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    const response = await getMyPet(petId.value);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unauthenticated";

      return;
    }

    pet.value = response;
    status.value = "ready";
  } catch (error) {
    pet.value = null;

    if (
      !isSessionUserRevisionCurrent(startedAt) ||
      (error instanceof MiniappApiError && error.statusCode === 401)
    ) {
      status.value = "unauthenticated";
    } else if (error instanceof MiniappApiError && [403, 404].includes(error.statusCode)) {
      status.value = "unavailable";
    } else {
      status.value = "error";
    }
  } finally {
    loading.value = false;
  }
}

function openLogin(): void {
  uni.navigateTo({ url: "/pages/auth/index" });
}

function returnToPets(): void {
  uni.redirectTo({ url: "/pages-account/pets/index" });
}

function editPet(): void {
  if (pet.value && !deleting.value) {
    uni.navigateTo({
      url: `/pages-account/pets/form?mode=edit&id=${encodeURIComponent(pet.value.id)}`,
    });
  }
}

async function removePet(): Promise<void> {
  const value = pet.value;

  if (!value || deleting.value) {
    return;
  }

  const confirmation = await uni
    .showModal({
      title: `删除${value.name}`,
      content: "删除后宠物档案和受管理图片将不再显示；存在受保护的关联记录时系统会拒绝删除。",
      confirmText: "删除",
      confirmColor: miniappDesignTokens.colors.danger,
    })
    .catch(() => null);

  if (!confirmation?.confirm) {
    return;
  }

  deleting.value = true;
  deleteError.value = "";
  const startedAt = captureSessionUserRevision();

  try {
    await deletePet(value.id);

    if (!isSessionUserRevisionCurrent(startedAt)) {
      pet.value = null;
      status.value = "unauthenticated";

      return;
    }

    await uni.showToast({ title: "宠物档案已删除", icon: "success" }).catch(() => undefined);

    try {
      await uni.navigateBack();
    } catch {
      deleteError.value = "档案已删除，请手动返回";
    }
  } catch (error) {
    if (isSessionUserRevisionCurrent(startedAt)) {
      deleteError.value = errorMessage(error, "删除失败，宠物档案仍保留，请重试");
    }
  } finally {
    deleting.value = false;
  }
}

onLoad((query = {}) => {
  if (typeof query.id !== "string" || !query.id) {
    status.value = "unavailable";

    return;
  }

  petId.value = query.id;
  void loadPet();
});

watch(
  () => session.bootstrapped,
  (bootstrapped) => {
    if (bootstrapped && petId.value && !pet.value) {
      void loadPet();
    }
  },
);

onShow(() => {
  if (skipInitialShow) {
    skipInitialShow = false;

    return;
  }

  void loadPet();
});
</script>

<template>
  <SubPageLayout title="宠物档案">
    <view class="flex flex-col gap-card px-action py-card">
      <PcStatePanel v-if="status === 'loading'" status="loading" title="宠物档案加载中…" />

      <PcStatePanel
        v-else-if="status === 'unauthenticated'"
        status="unauthenticated"
        title="登录后查看宠物档案"
        description="登录后可查看和维护自己的宠物资料。"
        primary-label="微信登录"
        @primary="openLogin"
      />

      <PcStatePanel
        v-else-if="status === 'unavailable'"
        status="unavailable"
        title="宠物档案不存在或无权查看"
        description="请返回我的宠物后重新选择一个档案。"
        primary-label="返回我的宠物"
        @primary="returnToPets"
      />

      <PcStatePanel
        v-else-if="status === 'error'"
        status="error"
        title="宠物档案加载失败"
        description="请检查网络后重试。"
        primary-label="重新加载"
        :primary-disabled="loading"
        @primary="loadPet"
      />

      <template v-else-if="pet">
        <view class="flex flex-col items-center main-card p-card">
          <image
            class="h-card-cover w-card-cover rounded-full bg-divider"
            :src="petCoverImage(pet)"
            mode="aspectFill"
          />
          <text class="mt-copy page-heading">{{ pet.name }}</text>
          <text class="mt-caption meta-text">{{ pet.breed }}</text>
        </view>

        <view class="main-card p-action">
          <text class="card-heading">基本信息</text>
          <view class="grid grid-cols-2 mt-copy gap-copy">
            <view v-for="fact in facts" :key="fact.label" class="rounded-control bg-divider p-copy">
              <text class="quiet-text">{{ fact.label }}</text>
              <text class="mt-caption block text-body text-ink font-medium leading-label">
                {{ fact.value }}
              </text>
            </view>
          </view>
        </view>

        <view class="main-card p-action">
          <text class="card-heading">照护信息</text>
          <view class="mt-copy flex flex-col gap-copy">
            <view class="rounded-control bg-divider p-copy">
              <text class="quiet-text">备注</text>
              <text class="mt-caption block text-body text-ink leading-body">
                {{ pet.notes || "未填写" }}
              </text>
            </view>
          </view>
        </view>

        <view class="main-card p-action">
          <view class="flex items-center justify-between">
            <text class="card-heading">宠物照片</text>
            <text class="quiet-text">{{ pet.photoUrls.length }} 张</text>
          </view>
          <scroll-view
            v-if="pet.photoUrls.length > 0"
            class="mt-copy w-full whitespace-nowrap"
            scroll-x
            :show-scrollbar="false"
          >
            <image
              v-for="url in pet.photoUrls"
              :key="url"
              class="mr-copy h-card-cover w-card-cover rounded-control bg-divider"
              :src="url"
              mode="aspectFill"
            />
          </scroll-view>
          <text v-else class="mt-copy block meta-text">暂未上传宠物照片</text>
        </view>

        <text v-if="deleteError" class="text-caption text-danger leading-caption" role="alert">
          {{ deleteError }}
        </text>
      </template>
    </view>

    <template v-if="status === 'ready' && pet" #actions>
      <view class="flex gap-copy">
        <PcButton block class="flex-[2]" :disabled="deleting" @click="editPet"> 编辑档案 </PcButton>
        <PcButton
          block
          class="flex-1"
          variant="danger"
          :loading="deleting"
          :disabled="deleting"
          @click="removePet"
        >
          {{ deleting ? "删除中…" : "删除档案" }}
        </PcButton>
      </view>
    </template>
  </SubPageLayout>
</template>
