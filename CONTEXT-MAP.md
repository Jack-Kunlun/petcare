# PetCare Context Map

## Contexts

- [Website Content](./apps/server/src/modules/website-content/CONTEXT.md) — 管理官网页面、全局内容、版本发布、区块和媒体素材。

## Relationships

- **Website Content → Admin**：Admin 允许获授权的平台运营人员编辑、预览和发布官网内容。
- **Website Content → Website**：Website 只展示已发布内容；短时预览明确指定的草稿修订。
- **Website Content → Classroom Article**：官网可展示已发布课堂文章，但课堂文章不属于官网页面内容版本。
