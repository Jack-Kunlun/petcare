export const settingsQueryKeys = {
  all: ["system-settings"] as const,
  overview: () => [...settingsQueryKeys.all, "overview"] as const,
  current: (domain: string, serviceType?: string) =>
    [...settingsQueryKeys.all, domain, serviceType ?? "all", "current"] as const,
  draft: (domain: string, serviceType?: string) =>
    [...settingsQueryKeys.all, domain, serviceType ?? "all", "draft"] as const,
  diff: (domain: string, serviceType?: string) =>
    [...settingsQueryKeys.all, domain, serviceType ?? "all", "diff"] as const,
  history: (domain: string, serviceType?: string) =>
    [...settingsQueryKeys.all, domain, serviceType ?? "all", "history"] as const,
  version: (domain: string, serviceType: string | undefined, versionId: string) =>
    [...settingsQueryKeys.all, domain, serviceType ?? "all", "history", versionId] as const,
};
