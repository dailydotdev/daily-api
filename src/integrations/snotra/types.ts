// Keep the type flexible to allow for future changes
export type ProfileRequest = {
  user_id: string;
};

export type ProfileResponse = {
  profile_text: string;
  update_at: string;
};

export enum PersonaliseState {
  Personalised = 'personalised',
  NonPersonalised = 'non_personalised',
}

export type UserProfileRequest = {
  user_id: string;
  providers: {
    personalise: Record<string, never>;
  };
};

export type UserProfileResponse = {
  personalise: {
    state: PersonaliseState;
  };
};

export interface ISnotraClient {
  getProfile(request: ProfileRequest): Promise<ProfileResponse>;
  getUserProfile(request: UserProfileRequest): Promise<UserProfileResponse>;
}
