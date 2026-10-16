import { ValidationPipe } from '@nestjs/common';

export function createValidationPipe() {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Numeric query parameters explicitly use @Type(() => Number).
    // Implicit Boolean conversion would turn the string "false" into true.
    transformOptions: { enableImplicitConversion: false },
  });
}
