export type UserStatePayload = {
  user_id: string;
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
