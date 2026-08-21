-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProviderRatingEligibilityStatus" AS ENUM ('insufficient_sample', 'eligible', 'warning', 'suspended');

-- CreateEnum
CREATE TYPE "ProviderRetrainingStatus" AS ENUM ('not_required', 'required', 'completed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "openid" TEXT,
    "phone" TEXT NOT NULL,
    "username" TEXT,
    "password_hash" TEXT,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT,
    "avatar_object_key" TEXT,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "user_type" TEXT NOT NULL DEFAULT 'pet_owner',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "real_name" TEXT,
    "gender" TEXT,
    "age" INTEGER,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "id_card_verified" BOOLEAN NOT NULL DEFAULT false,
    "wechat_score" INTEGER,
    "training_passed" BOOLEAN NOT NULL DEFAULT false,
    "certified_sitter" BOOLEAN NOT NULL DEFAULT false,
    "reject_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_certification_applications" (
    "id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "real_name_masked" TEXT NOT NULL,
    "id_card_masked" TEXT NOT NULL,
    "id_card_front_url" TEXT NOT NULL,
    "id_card_back_url" TEXT NOT NULL,
    "wechat_score" INTEGER,
    "training_passed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reject_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_certification_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "age" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION,
    "gender" TEXT NOT NULL,
    "sterilized" BOOLEAN NOT NULL DEFAULT false,
    "habits" TEXT,
    "allergies" TEXT,
    "photos" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider_id" TEXT,
    "pet_id" TEXT NOT NULL,
    "service_time" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_confirm',
    "remark" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sop_config_version_id" TEXT,
    "fee_config_version_id" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_fee_snapshots" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "fee_config_version_id" TEXT NOT NULL,
    "input_amount_cents" INTEGER NOT NULL,
    "platform_commission_bps" INTEGER NOT NULL,
    "platform_commission_cents" INTEGER NOT NULL,
    "reward_service_fee_cents" INTEGER NOT NULL,
    "withdrawal_fee_bps" INTEGER NOT NULL,
    "minimum_withdrawal_fee_cents" INTEGER NOT NULL,
    "provider_settlement_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_fee_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_rewards" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reward_amount" INTEGER NOT NULL,
    "price_range_min" INTEGER NOT NULL,
    "price_range_max" INTEGER NOT NULL,
    "expire_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_platforms" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "platform_price" INTEGER NOT NULL,
    "assigned_provider_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_intents" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "intent_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sops" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "expected_duration_minutes" INTEGER NOT NULL,
    "minimum_photo_count" INTEGER NOT NULL,
    "video_required" BOOLEAN NOT NULL DEFAULT false,
    "violation_guidance" TEXT NOT NULL,
    "photos" TEXT[],
    "videos" TEXT[],
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_sops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config_versions" (
    "id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "business_version" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "draft_slot" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "published_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "source_version_id" TEXT,
    "idempotency_key" TEXT,
    "change_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config_pointers" (
    "config_key" TEXT NOT NULL,
    "published_version_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pointers_pkey" PRIMARY KEY ("config_key")
);

-- CreateTable
CREATE TABLE "sop_config_steps" (
    "id" TEXT NOT NULL,
    "config_version_id" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "step_name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "expected_duration_minutes" INTEGER NOT NULL,
    "minimum_photo_count" INTEGER NOT NULL,
    "video_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sop_config_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sop_violation_rules" (
    "id" TEXT NOT NULL,
    "config_version_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "service_fee_deduction_bps" INTEGER,
    "rating_deduction_score" INTEGER NOT NULL DEFAULT 0,
    "suspension_days" INTEGER NOT NULL DEFAULT 0,
    "retraining_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "sop_violation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating_threshold_configs" (
    "id" TEXT NOT NULL,
    "config_version_id" TEXT NOT NULL,
    "evaluation_window" INTEGER NOT NULL,
    "minimum_sample_size" INTEGER NOT NULL,
    "warning_score" INTEGER NOT NULL,
    "suspension_score" INTEGER NOT NULL,
    "retraining_requirement" TEXT NOT NULL,

    CONSTRAINT "rating_threshold_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_configs" (
    "id" TEXT NOT NULL,
    "config_version_id" TEXT NOT NULL,
    "platform_commission_bps" INTEGER NOT NULL,
    "reward_service_fee_cents" INTEGER NOT NULL,
    "withdrawal_fee_bps" INTEGER NOT NULL,
    "minimum_withdrawal_fee_cents" INTEGER NOT NULL,

    CONSTRAINT "fee_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config_audit_events" (
    "id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_version_id" TEXT,
    "operator_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "change_summary" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_config_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_contents" (
    "id" TEXT NOT NULL,
    "content_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "current_draft_version_id" TEXT,
    "published_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_content_versions" (
    "id" TEXT NOT NULL,
    "website_content_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "business_version" INTEGER,
    "seo" JSONB NOT NULL,
    "source_version_id" TEXT,
    "idempotency_key" TEXT,
    "change_summary" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "published_by_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_content_sections" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "section_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "settings" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_media_assets" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_preview_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "website_content_id" TEXT NOT NULL,
    "content_version_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_preview_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_content_audit_logs" (
    "id" TEXT NOT NULL,
    "website_content_id" TEXT,
    "content_version_id" TEXT,
    "media_asset_id" TEXT,
    "operator_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "revision" INTEGER,
    "business_version" INTEGER,
    "request_id" TEXT NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_content_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "attitude_rating" INTEGER NOT NULL,
    "professional_rating" INTEGER NOT NULL,
    "punctuality_rating" INTEGER NOT NULL,
    "sop_execution_rating" INTEGER NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "content" TEXT,
    "photos" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_rating_eligibilities" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "rating_config_version_id" TEXT NOT NULL,
    "evaluation_key" TEXT NOT NULL,
    "status" "ProviderRatingEligibilityStatus" NOT NULL DEFAULT 'insufficient_sample',
    "average_score" INTEGER,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "retraining_requirement" TEXT,
    "retraining_status" "ProviderRetrainingStatus" NOT NULL DEFAULT 'not_required',
    "action_deduplication_key" TEXT,
    "suspended_at" TIMESTAMP(3),
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_rating_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_todos" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deduplication_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "complainant_id" TEXT NOT NULL,
    "respondent_id" TEXT NOT NULL,
    "assigned_admin_id" TEXT,
    "complaint_type" TEXT NOT NULL,
    "expected_solution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_response',
    "appeal_deadline_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_statements" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "evidence_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_decisions" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "decision_admin_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "liability" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "refund_amount" INTEGER NOT NULL,
    "settlement_amount" INTEGER NOT NULL,
    "complainant_credit_delta" INTEGER NOT NULL,
    "respondent_credit_delta" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_assignments" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "assignee_admin_id" TEXT NOT NULL,
    "assigned_by_admin_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_events" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "payload" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_execution_tasks" (
    "id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,
    "decision_level" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispute_execution_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_money_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "execution_task_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "business_reference" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_money_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "media_urls" TEXT[],
    "tags" TEXT[],
    "pet_id" TEXT,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "shares_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "cover_url" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "author_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classroom_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "commenter_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parent_comment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "following_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reference_id" TEXT,
    "deduplication_key" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "role_name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "permission_code" TEXT NOT NULL,
    "permission_name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_audit_logs" (
    "id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "changes" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credit_score" INTEGER NOT NULL DEFAULT 100,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "change_amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "related_order_id" TEXT,
    "business_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_user_type_idx" ON "users"("user_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "providers_user_id_key" ON "providers"("user_id");

-- CreateIndex
CREATE INDEX "providers_certified_sitter_idx" ON "providers"("certified_sitter");

-- CreateIndex
CREATE INDEX "provider_certification_applications_status_created_at_idx" ON "provider_certification_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "provider_certification_applications_applicant_id_created_at_idx" ON "provider_certification_applications"("applicant_id", "created_at");

-- CreateIndex
CREATE INDEX "pets_owner_id_idx" ON "pets"("owner_id");

-- CreateIndex
CREATE INDEX "orders_owner_id_idx" ON "orders"("owner_id");

-- CreateIndex
CREATE INDEX "orders_provider_id_idx" ON "orders"("provider_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_order_type_idx" ON "orders"("order_type");

-- CreateIndex
CREATE INDEX "orders_sop_config_version_id_idx" ON "orders"("sop_config_version_id");

-- CreateIndex
CREATE INDEX "orders_fee_config_version_id_idx" ON "orders"("fee_config_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_fee_snapshots_order_id_key" ON "order_fee_snapshots"("order_id");

-- CreateIndex
CREATE INDEX "order_fee_snapshots_fee_config_version_id_idx" ON "order_fee_snapshots"("fee_config_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_rewards_order_id_key" ON "order_rewards"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_platforms_order_id_key" ON "order_platforms"("order_id");

-- CreateIndex
CREATE INDEX "order_intents_order_id_idx" ON "order_intents"("order_id");

-- CreateIndex
CREATE INDEX "order_intents_provider_id_idx" ON "order_intents"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_intents_order_id_provider_id_key" ON "order_intents"("order_id", "provider_id");

-- CreateIndex
CREATE INDEX "order_sops_order_id_idx" ON "order_sops"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_versions_idempotency_key_key" ON "system_config_versions"("idempotency_key");

-- CreateIndex
CREATE INDEX "system_config_versions_config_key_status_idx" ON "system_config_versions"("config_key", "status");

-- CreateIndex
CREATE INDEX "system_config_versions_source_version_id_idx" ON "system_config_versions"("source_version_id");

-- CreateIndex
CREATE INDEX "system_config_versions_created_by_id_idx" ON "system_config_versions"("created_by_id");

-- CreateIndex
CREATE INDEX "system_config_versions_updated_by_id_idx" ON "system_config_versions"("updated_by_id");

-- CreateIndex
CREATE INDEX "system_config_versions_published_by_id_idx" ON "system_config_versions"("published_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_versions_config_key_business_version_key" ON "system_config_versions"("config_key", "business_version");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_versions_config_key_draft_slot_key" ON "system_config_versions"("config_key", "draft_slot");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_pointers_published_version_id_key" ON "system_config_pointers"("published_version_id");

-- CreateIndex
CREATE INDEX "sop_config_steps_config_version_id_idx" ON "sop_config_steps"("config_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "sop_config_steps_config_version_id_service_type_step_number_key" ON "sop_config_steps"("config_version_id", "service_type", "step_number");

-- CreateIndex
CREATE INDEX "sop_violation_rules_config_version_id_sort_order_idx" ON "sop_violation_rules"("config_version_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "sop_violation_rules_config_version_id_severity_key" ON "sop_violation_rules"("config_version_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "rating_threshold_configs_config_version_id_key" ON "rating_threshold_configs"("config_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "fee_configs_config_version_id_key" ON "fee_configs"("config_version_id");

-- CreateIndex
CREATE INDEX "system_config_audit_events_config_key_created_at_idx" ON "system_config_audit_events"("config_key", "created_at");

-- CreateIndex
CREATE INDEX "system_config_audit_events_config_version_id_idx" ON "system_config_audit_events"("config_version_id");

-- CreateIndex
CREATE INDEX "system_config_audit_events_operator_id_idx" ON "system_config_audit_events"("operator_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_config_audit_events_config_key_idempotency_key_key" ON "system_config_audit_events"("config_key", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "website_contents_content_key_key" ON "website_contents"("content_key");

-- CreateIndex
CREATE UNIQUE INDEX "website_contents_current_draft_version_id_key" ON "website_contents"("current_draft_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_contents_published_version_id_key" ON "website_contents"("published_version_id");

-- CreateIndex
CREATE INDEX "website_contents_content_type_idx" ON "website_contents"("content_type");

-- CreateIndex
CREATE UNIQUE INDEX "website_content_versions_idempotency_key_key" ON "website_content_versions"("idempotency_key");

-- CreateIndex
CREATE INDEX "website_content_versions_website_content_id_status_idx" ON "website_content_versions"("website_content_id", "status");

-- CreateIndex
CREATE INDEX "website_content_versions_source_version_id_idx" ON "website_content_versions"("source_version_id");

-- CreateIndex
CREATE INDEX "website_content_versions_created_by_id_idx" ON "website_content_versions"("created_by_id");

-- CreateIndex
CREATE INDEX "website_content_versions_published_by_id_idx" ON "website_content_versions"("published_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_content_versions_website_content_id_revision_key" ON "website_content_versions"("website_content_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "website_content_versions_website_content_id_business_versio_key" ON "website_content_versions"("website_content_id", "business_version");

-- CreateIndex
CREATE INDEX "website_content_sections_version_id_sort_order_idx" ON "website_content_sections"("version_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "website_content_sections_version_id_section_key_key" ON "website_content_sections"("version_id", "section_key");

-- CreateIndex
CREATE UNIQUE INDEX "website_content_sections_version_id_sort_order_key" ON "website_content_sections"("version_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "website_media_assets_storage_key_key" ON "website_media_assets"("storage_key");

-- CreateIndex
CREATE INDEX "website_media_assets_status_created_at_idx" ON "website_media_assets"("status", "created_at");

-- CreateIndex
CREATE INDEX "website_media_assets_checksum_idx" ON "website_media_assets"("checksum");

-- CreateIndex
CREATE INDEX "website_media_assets_created_by_id_idx" ON "website_media_assets"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_preview_tokens_token_hash_key" ON "website_preview_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "website_preview_tokens_website_content_id_content_version_i_idx" ON "website_preview_tokens"("website_content_id", "content_version_id");

-- CreateIndex
CREATE INDEX "website_preview_tokens_expires_at_revoked_at_idx" ON "website_preview_tokens"("expires_at", "revoked_at");

-- CreateIndex
CREATE INDEX "website_preview_tokens_created_by_id_idx" ON "website_preview_tokens"("created_by_id");

-- CreateIndex
CREATE INDEX "website_content_audit_logs_website_content_id_created_at_idx" ON "website_content_audit_logs"("website_content_id", "created_at");

-- CreateIndex
CREATE INDEX "website_content_audit_logs_content_version_id_idx" ON "website_content_audit_logs"("content_version_id");

-- CreateIndex
CREATE INDEX "website_content_audit_logs_media_asset_id_idx" ON "website_content_audit_logs"("media_asset_id");

-- CreateIndex
CREATE INDEX "website_content_audit_logs_operator_id_created_at_idx" ON "website_content_audit_logs"("operator_id", "created_at");

-- CreateIndex
CREATE INDEX "website_content_audit_logs_request_id_idx" ON "website_content_audit_logs"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_order_id_key" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_idx" ON "reviews"("reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_rating_eligibilities_provider_id_key" ON "provider_rating_eligibilities"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_rating_eligibilities_evaluation_key_key" ON "provider_rating_eligibilities"("evaluation_key");

-- CreateIndex
CREATE INDEX "provider_rating_eligibilities_status_idx" ON "provider_rating_eligibilities"("status");

-- CreateIndex
CREATE INDEX "provider_rating_eligibilities_rating_config_version_id_idx" ON "provider_rating_eligibilities"("rating_config_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_todos_deduplication_key_key" ON "admin_todos"("deduplication_key");

-- CreateIndex
CREATE INDEX "admin_todos_status_created_at_idx" ON "admin_todos"("status", "created_at");

-- CreateIndex
CREATE INDEX "admin_todos_provider_id_idx" ON "admin_todos"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_case_number_key" ON "complaints"("case_number");

-- CreateIndex
CREATE INDEX "complaints_status_assigned_admin_id_idx" ON "complaints"("status", "assigned_admin_id");

-- CreateIndex
CREATE INDEX "complaints_order_id_status_idx" ON "complaints"("order_id", "status");

-- CreateIndex
CREATE INDEX "complaints_appeal_deadline_at_idx" ON "complaints"("appeal_deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_statements_complaint_id_stage_author_id_key" ON "complaint_statements"("complaint_id", "stage", "author_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_decisions_complaint_id_level_key" ON "dispute_decisions"("complaint_id", "level");

-- CreateIndex
CREATE INDEX "complaint_assignments_complaint_id_created_at_idx" ON "complaint_assignments"("complaint_id", "created_at");

-- CreateIndex
CREATE INDEX "complaint_events_complaint_id_created_at_idx" ON "complaint_events"("complaint_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_execution_tasks_idempotency_key_key" ON "dispute_execution_tasks"("idempotency_key");

-- CreateIndex
CREATE INDEX "dispute_execution_tasks_complaint_id_status_idx" ON "dispute_execution_tasks"("complaint_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_money_records_execution_task_id_key" ON "dispute_money_records"("execution_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "dispute_money_records_business_reference_key" ON "dispute_money_records"("business_reference");

-- CreateIndex
CREATE INDEX "dispute_money_records_complaint_id_type_created_at_idx" ON "dispute_money_records"("complaint_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "dispute_money_records_user_id_created_at_idx" ON "dispute_money_records"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "dispute_money_records_order_id_created_at_idx" ON "dispute_money_records"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "posts_created_at_idx" ON "posts"("created_at");

-- CreateIndex
CREATE INDEX "classroom_articles_status_idx" ON "classroom_articles"("status");

-- CreateIndex
CREATE INDEX "classroom_articles_created_at_idx" ON "classroom_articles"("created_at");

-- CreateIndex
CREATE INDEX "comments_post_id_idx" ON "comments"("post_id");

-- CreateIndex
CREATE INDEX "comments_commenter_id_idx" ON "comments"("commenter_id");

-- CreateIndex
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

-- CreateIndex
CREATE INDEX "follows_following_id_idx" ON "follows"("following_id");

-- CreateIndex
CREATE UNIQUE INDEX "follows_follower_id_following_id_key" ON "follows"("follower_id", "following_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE INDEX "favorites_post_id_idx" ON "favorites"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_post_id_key" ON "favorites"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_deduplication_key_key" ON "notifications"("deduplication_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permission_code_key" ON "permissions"("permission_code");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "permissions_type_idx" ON "permissions"("type");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_operator_id_idx" ON "permission_audit_logs"("operator_id");

-- CreateIndex
CREATE INDEX "permission_audit_logs_created_at_idx" ON "permission_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_scores_user_id_key" ON "credit_scores"("user_id");

-- CreateIndex
CREATE INDEX "credit_scores_credit_score_idx" ON "credit_scores"("credit_score");

-- CreateIndex
CREATE UNIQUE INDEX "credit_records_business_reference_key" ON "credit_records"("business_reference");

-- CreateIndex
CREATE INDEX "credit_records_user_id_idx" ON "credit_records"("user_id");

-- CreateIndex
CREATE INDEX "credit_records_created_at_idx" ON "credit_records"("created_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "providers" ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_certification_applications" ADD CONSTRAINT "provider_certification_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_certification_applications" ADD CONSTRAINT "provider_certification_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_sop_config_version_id_fkey" FOREIGN KEY ("sop_config_version_id") REFERENCES "system_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_fee_config_version_id_fkey" FOREIGN KEY ("fee_config_version_id") REFERENCES "system_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fee_snapshots" ADD CONSTRAINT "order_fee_snapshots_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_fee_snapshots" ADD CONSTRAINT "order_fee_snapshots_fee_config_version_id_fkey" FOREIGN KEY ("fee_config_version_id") REFERENCES "system_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_rewards" ADD CONSTRAINT "order_rewards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_platforms" ADD CONSTRAINT "order_platforms_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_intents" ADD CONSTRAINT "order_intents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_intents" ADD CONSTRAINT "order_intents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sops" ADD CONSTRAINT "order_sops_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_versions" ADD CONSTRAINT "system_config_versions_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "system_config_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_versions" ADD CONSTRAINT "system_config_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_versions" ADD CONSTRAINT "system_config_versions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_versions" ADD CONSTRAINT "system_config_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_pointers" ADD CONSTRAINT "system_config_pointers_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "system_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_config_steps" ADD CONSTRAINT "sop_config_steps_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "system_config_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sop_violation_rules" ADD CONSTRAINT "sop_violation_rules_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "system_config_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rating_threshold_configs" ADD CONSTRAINT "rating_threshold_configs_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "system_config_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_configs" ADD CONSTRAINT "fee_configs_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "system_config_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_audit_events" ADD CONSTRAINT "system_config_audit_events_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "system_config_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_config_audit_events" ADD CONSTRAINT "system_config_audit_events_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_contents" ADD CONSTRAINT "website_contents_current_draft_version_id_fkey" FOREIGN KEY ("current_draft_version_id") REFERENCES "website_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_contents" ADD CONSTRAINT "website_contents_published_version_id_fkey" FOREIGN KEY ("published_version_id") REFERENCES "website_content_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_versions" ADD CONSTRAINT "website_content_versions_website_content_id_fkey" FOREIGN KEY ("website_content_id") REFERENCES "website_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_versions" ADD CONSTRAINT "website_content_versions_source_version_id_fkey" FOREIGN KEY ("source_version_id") REFERENCES "website_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_versions" ADD CONSTRAINT "website_content_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_versions" ADD CONSTRAINT "website_content_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_sections" ADD CONSTRAINT "website_content_sections_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "website_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_media_assets" ADD CONSTRAINT "website_media_assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_preview_tokens" ADD CONSTRAINT "website_preview_tokens_website_content_id_fkey" FOREIGN KEY ("website_content_id") REFERENCES "website_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_preview_tokens" ADD CONSTRAINT "website_preview_tokens_content_version_id_fkey" FOREIGN KEY ("content_version_id") REFERENCES "website_content_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_preview_tokens" ADD CONSTRAINT "website_preview_tokens_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_audit_logs" ADD CONSTRAINT "website_content_audit_logs_website_content_id_fkey" FOREIGN KEY ("website_content_id") REFERENCES "website_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_audit_logs" ADD CONSTRAINT "website_content_audit_logs_content_version_id_fkey" FOREIGN KEY ("content_version_id") REFERENCES "website_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_audit_logs" ADD CONSTRAINT "website_content_audit_logs_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "website_media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_content_audit_logs" ADD CONSTRAINT "website_content_audit_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rating_eligibilities" ADD CONSTRAINT "provider_rating_eligibilities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_rating_eligibilities" ADD CONSTRAINT "provider_rating_eligibilities_rating_config_version_id_fkey" FOREIGN KEY ("rating_config_version_id") REFERENCES "system_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_todos" ADD CONSTRAINT "admin_todos_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_complainant_id_fkey" FOREIGN KEY ("complainant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_statements" ADD CONSTRAINT "complaint_statements_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_statements" ADD CONSTRAINT "complaint_statements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_decision_admin_id_fkey" FOREIGN KEY ("decision_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_assignee_admin_id_fkey" FOREIGN KEY ("assignee_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_assignments" ADD CONSTRAINT "complaint_assignments_assigned_by_admin_id_fkey" FOREIGN KEY ("assigned_by_admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_events" ADD CONSTRAINT "complaint_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_execution_tasks" ADD CONSTRAINT "dispute_execution_tasks_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_execution_tasks" ADD CONSTRAINT "dispute_execution_tasks_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "dispute_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_money_records" ADD CONSTRAINT "dispute_money_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_money_records" ADD CONSTRAINT "dispute_money_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_money_records" ADD CONSTRAINT "dispute_money_records_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_money_records" ADD CONSTRAINT "dispute_money_records_execution_task_id_fkey" FOREIGN KEY ("execution_task_id") REFERENCES "dispute_execution_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_articles" ADD CONSTRAINT "classroom_articles_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_commenter_id_fkey" FOREIGN KEY ("commenter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_scores" ADD CONSTRAINT "credit_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_records" ADD CONSTRAINT "credit_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
