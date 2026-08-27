import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { PetController } from "./pet.controller";
import { PetService } from "./pet.service";

/** Registers authenticated owner-only pet-profile capabilities. */
@Module({
  imports: [AuthModule],
  controllers: [PetController],
  providers: [PetService],
})
export class PetModule {}
