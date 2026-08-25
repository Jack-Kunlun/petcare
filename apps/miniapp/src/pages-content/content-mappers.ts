import type {
  WebsiteContactPanelSection,
  WebsiteLinkDestination,
  WebsitePublicContent,
  WebsiteRichTextSection,
} from "@petcare/shared-types";
import { WEBSITE_SECTION_TYPE } from "@petcare/shared-types";

export interface HelpCategory {
  key: string;
  title: string;
  questions: Array<{ key: string; question: string; answer: string }>;
}

export type ContactAction = { kind: "phone" | "email"; value: string } | { kind: "none" };

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

export function toRichTextContent(
  content: WebsitePublicContent,
): WebsiteRichTextSection["content"][] {
  return content.sections.flatMap((section) =>
    section.isEnabled && section.sectionType === WEBSITE_SECTION_TYPE.RICH_TEXT
      ? [section.content]
      : [],
  );
}

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
