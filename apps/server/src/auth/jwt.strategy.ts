import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "../config/config.service";
import { AccessTokenPayload } from "./auth.types";
import { SessionValidationService } from "./session-validation.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly sessionValidationService: SessionValidationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.jwtSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AccessTokenPayload> {
    if (
      payload.type !== "access" ||
      !payload.sub ||
      !payload.sid ||
      !Number.isInteger(payload.sessionVersion)
    ) {
      throw new UnauthorizedException("登录状态已失效");
    }

    await this.sessionValidationService.assertActiveVersion(payload.sub, payload.sessionVersion);

    return payload;
  }
}
