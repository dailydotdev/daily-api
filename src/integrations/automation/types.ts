/**
 * An interface for an automation service (Retool, Zapier, etc)
 */
export interface IAutomationService<Args, Ret> {
  run(args: Args): Promise<Ret>;
}

export enum Automation {
  Roaster = 'roaster',
}
