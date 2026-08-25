import { HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiException } from "../../common/http/api-exception";
import { ApiExceptionFilter } from "../../common/http/api-exception.filter";
import { AppLogger } from "../../logging/app-logger.service";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController public profile", () => {
  it("returns one non-disclosing 404 envelope for a hidden account", async () => {
    const userService = {
      findOne: jest
        .fn()
        .mockRejectedValue(
          new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND),
        ),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();
    const app = moduleRef.createNestApplication();

    app.useGlobalFilters(new ApiExceptionFilter({ write: jest.fn() } as unknown as AppLogger));
    await app.init();

    const response = await request(app.getHttpServer()).get("/users/hidden-user").expect(404);

    expect(response.body).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      message: "用户不存在",
      data: null,
    });
    expect(response.body).not.toHaveProperty("profile");
    expect(userService.findOne).toHaveBeenCalledWith("hidden-user");

    await app.close();
  });
});
