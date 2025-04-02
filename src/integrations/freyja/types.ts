// Keep the type flexible to allow for future changes
export type FunnelState = {
  session: {
    id: string;
    currentStep: string;
    userId: string;
  } & Record<string, unknown>;
  funnel: {
    id: string;
    version: number;
  } & Record<string, unknown>;
};

export interface IFreyjaClient {
  createSession(
    userId: string,
    funnelId: string,
    version?: number,
  ): Promise<FunnelState>;
  getSession(sessionId: string): Promise<FunnelState>;
}
