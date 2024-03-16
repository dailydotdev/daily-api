export type UserStatePayload = {
  user_id: string;
  post_rank_count?: number;
  providers: {
    personalise: Record<string, never>;
  };
};

export type UserState = 'personalised' | 'non_personalised';

export type UserStateResponse = {
  personalise: {
    state: UserState;
  };
};

export interface ISnotraClient {
  fetchUserState(payload: UserStatePayload): Promise<UserStateResponse>;
}
