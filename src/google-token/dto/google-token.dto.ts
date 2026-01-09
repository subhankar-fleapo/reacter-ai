export class UpsertGoogleTokenDto {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export class GetGoogleTokenByPhoneDto {
  message: string;
}
