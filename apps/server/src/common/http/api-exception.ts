import { HttpException, HttpStatus } from "@nestjs/common";

export class ApiException extends HttpException {
  constructor(
    public readonly code: string,
    public readonly clientMessage: string,
    status: HttpStatus,
  ) {
    super({ code, message: clientMessage }, status);
  }
}
