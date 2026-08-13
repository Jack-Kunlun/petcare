import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SaveWebsiteContentDraftDto } from "./admin-website-content.dto";

describe("SaveWebsiteContentDraftDto", () => {
  it("accepts the required boolean state in a complete preset section snapshot", async () => {
    const dto = plainToInstance(SaveWebsiteContentDraftDto, {
      revision: 2,
      changeSummary: "Update the home hero",
      seo: {
        title: "PetCare",
        description: "PetCare official website",
        canonicalPath: "/",
        image: null,
      },
      sections: [
        {
          sectionKey: "hero",
          sectionType: "hero",
          sortOrder: 1,
          isEnabled: true,
          schemaVersion: 1,
          content: {},
          settings: {},
        },
      ],
    });

    await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toEqual([]);
  });
});
