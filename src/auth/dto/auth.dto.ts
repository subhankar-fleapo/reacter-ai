export class SignupDto {
  phone: string;
  password: string;
  timezoneOffset?: string;
}

export class LoginDto {
  phone: string;
  password: string;
}
