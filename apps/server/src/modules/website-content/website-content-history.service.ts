import { Injectable } from "@nestjs/common";
import {
  type WebsiteContentHistoryQuery,
  type WebsiteContentHistoryResponse,
  type WebsiteContentKey,
  type WebsiteContentVersion,
} from "@petcare/shared-types";
import {
  type RestoreWebsiteContentDraftCommand,
  WebsiteContentRepository,
} from "./website-content.repository";

/** Provides immutable Website Content history reads and restore-as-draft commands. */
@Injectable()
export class WebsiteContentHistoryService {
  constructor(private readonly repository: WebsiteContentRepository) {}

  /** Lists the published business-version history for one content unit. */
  listHistory(
    contentKey: WebsiteContentKey,
    query: WebsiteContentHistoryQuery,
  ): Promise<WebsiteContentHistoryResponse> {
    return this.repository.listHistory(contentKey, query);
  }

  /** Reads one immutable published-history snapshot. */
  getHistoryVersion(
    contentKey: WebsiteContentKey,
    versionId: string,
  ): Promise<WebsiteContentVersion> {
    return this.repository.getHistoryVersion(contentKey, versionId);
  }

  /** Restores a selected historical snapshot as a fresh unpublished draft. */
  restoreAsDraft(command: RestoreWebsiteContentDraftCommand): Promise<WebsiteContentVersion> {
    return this.repository.restoreAsDraft(command);
  }
}
