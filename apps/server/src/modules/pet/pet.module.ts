import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { WebsiteContentModule } from "../website-content/website-content.module";
import { PetMediaService } from "./pet-media.service";
import { PetController } from "./pet.controller";
import { PetService } from "./pet.service";

/** Registers authenticated owner-only pet-profile capabilities. */
@Module({
  imports: [AuthModule, WebsiteContentModule],
  controllers: [PetController],
  providers: [PetService, PetMediaService],
})
export class PetModule {}
