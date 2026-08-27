import { HttpStatus } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { ApiException } from "../../common/http/api-exception";
import { ApiExceptionFilter } from "../../common/http/api-exception.filter";
import { AppLogger } from "../../logging/app-logger.service";
import { PublicUserProfileDto, UserResponseDto } from "./dto/user-response.dto";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController public profile", () => {
  it("documents the exact anonymous-safe public user shape", () => {
    const userProperties = Reflect.getMetadata(
      "swagger/apiModelPropertiesArray",
      UserResponseDto.prototype,
    ) as string[];
    const profileProperties = Reflect.getMetadata(
      "swagger/apiModelPropertiesArray",
      PublicUserProfileDto.prototype,
    ) as string[];

    expect(userProperties).toEqual([
      ":id",
      ":nickname",
      ":avatar",
      ":userType",
      ":status",
      ":profile",
    ]);
    expect(profileProperties).toEqual([":region", ":bio"]);
    expect(Reflect.getMetadata(GUARDS_METADATA, UserController.prototype.findOne)).toBeUndefined();
  });

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

  it("does not expose the removed legacy registration endpoint", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: { findOne: jest.fn() } }],
    }).compile();
    const app = moduleRef.createNestApplication();

    await app.init();

    await request(app.getHttpServer())
      .post("/users/register")
      .send({ phone: "13800138000", code: "123456", nickname: "未验证账户" })
      .expect(404);

    await app.close();
  });
});
