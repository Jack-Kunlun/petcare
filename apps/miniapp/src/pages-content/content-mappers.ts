import type {
  WebsiteContactPanelSection,
  WebsiteLinkDestination,
  WebsitePublicContent,
  WebsiteRichTextSection,
} from "@petcare/shared-types";
import { WEBSITE_SECTION_TYPE } from "@petcare/shared-types";

/** One enabled Help category ready for ordered Miniapp rendering. */
export interface HelpCategory {
  /** Stable category key inherited from the managed section. */
  key: string;
  /** Visible category title. */
  title: string;
  /** Ordered questions configured for this category. */
  questions: Array<{
    /** Stable question key inherited from the managed rich-text part. */
    key: string;
    /** Visible question text. */
    question: string;
    /** Plain-text answer with configured paragraphs separated by newlines. */
    answer: string;
  }>;
}

/** Locally validated action available for a managed contact destination. */
export type ContactAction =
  | {
      /** Opens the native phone dialer. */
      kind: "phone";
      /** Validated phone number passed to the dialer. */
      value: string;
    }
  | {
      /** Copies the configured support email address. */
      kind: "email";
      /** Validated email address copied for the user. */
      value: string;
    }
  | {
      /** Exposes no executable action for unsupported or invalid destinations. */
      kind: "none";
    };

/** Maps enabled rich-text sections to ordered Help categories and questions. */
export function toHelpCategories(content: WebsitePublicContent): HelpCategory[] {
  return content.sections.flatMap((section) =>
    section.isEnabled && section.sectionType === WEBSITE_SECTION_TYPE.RICH_TEXT
      ? [
          {
            key: section.sectionKey,
            title: section.content.title,
            questions: section.content.parts.map((part) => ({
              key: part.partKey,
              question: part.heading,
              answer: part.paragraphs.join("\n"),
            })),
          },
        ]
      : [],
  );
}

/** Filters Help questions in memory by category, question, or answer text. */
export function filterHelpCategories(categories: HelpCategory[], query: string): HelpCategory[] {
  const keyword = query.trim().toLowerCase();

  if (!keyword) {
    return categories;
  }

  return categories.flatMap((category) => {
    const questions = category.title.toLowerCase().includes(keyword)
      ? category.questions
      : category.questions.filter(({ question, answer }) =>
          `${question}\n${answer}`.toLowerCase().includes(keyword),
        );

    return questions.length > 0 ? [{ ...category, questions }] : [];
  });
}

/** Selects enabled structured rich-text content for legal-page rendering. */
export function toRichTextContent(
  content: WebsitePublicContent,
): WebsiteRichTextSection["content"][] {
  return content.sections.flatMap((section) =>
    section.isEnabled && section.sectionType === WEBSITE_SECTION_TYPE.RICH_TEXT
      ? [section.content]
      : [],
  );
}

/** Returns the first enabled managed contact panel, if one is published. */
export function toContactPanel(
  content: WebsitePublicContent,
): WebsiteContactPanelSection["content"] | null {
  for (const section of content.sections) {
    if (section.isEnabled && section.sectionType === WEBSITE_SECTION_TYPE.CONTACT_PANEL) {
      return section.content;
    }
  }

  return null;
}

/** Converts only locally valid phone and email destinations into executable actions. */
export function getContactAction(href: WebsiteLinkDestination): ContactAction {
  if (href.startsWith("tel:")) {
    const value = href.slice(4).replace(/[\s-]/gu, "");

    return /^\+?\d{5,20}$/u.test(value) ? { kind: "phone", value } : { kind: "none" };
  }

  if (href.startsWith("mailto:")) {
    const value = href.slice(7).split("?", 1)[0];
    const atIndex = value.indexOf("@");
    const dotIndex = value.lastIndexOf(".");
    const isValid =
      atIndex > 0 &&
      dotIndex > atIndex + 1 &&
      dotIndex < value.length - 1 &&
      !value.slice(atIndex + 1).includes("@") &&
      !/\s/u.test(value);

    return isValid ? { kind: "email", value } : { kind: "none" };
  }

  return { kind: "none" };
}
