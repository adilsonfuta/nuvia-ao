import { Body, Controller, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { DatabaseService } from "./database";

export class VendorApplicationDto {
  @IsString() @MinLength(2) @MaxLength(120) businessName!: string;
  @IsString() @MinLength(2) @MaxLength(120) contactName!: string;
  @IsEmail() @MaxLength(180) email!: string;
  @IsString() @MinLength(7) @MaxLength(40) phone!: string;
  @IsString() @MinLength(2) @MaxLength(80) category!: string;
  @IsString() @MinLength(2) @MaxLength(80) province!: string;
  @IsOptional() @IsString() @MaxLength(100) municipality?: string;
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsOptional()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  @MaxLength(250)
  website?: string;
  @IsString() @MinLength(20) @MaxLength(2000) message!: string;
}

@ApiTags("Candidaturas de fornecedores")
@Controller("vendor-applications")
export class VendorApplicationsController {
  constructor(private readonly db: DatabaseService) {}

  @Post()
  async create(@Body() body: VendorApplicationDto) {
    const application = await this.db.vendorApplication.create({
      data: {
        ...body,
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
      },
      select: { id: true, status: true, createdAt: true },
    });
    return {
      ...application,
      message:
        "Candidatura recebida. A equipa irá rever os dados antes de publicar o perfil.",
    };
  }
}
