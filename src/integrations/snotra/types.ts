// Keep the type flexible to allow for future changes
export interface ProfileRequest {
  user_id: string;
}

export interface ProfileResponse {
  profile_text: string;
  update_at: string;
}

export interface ISnotraClient {
  getProfile(request: ProfileRequest): Promise<ProfileResponse>;
}
