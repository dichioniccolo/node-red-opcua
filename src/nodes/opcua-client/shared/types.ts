export enum OpcuaClientActionEnum {
  READ = "read",
  WRITE = "write",
}

export interface OpcuaClientOptions {
  config?: string;
  action?: OpcuaClientActionEnum;
}

export type OpcuaClientStatus =
  | "connected"
  | "disconnected"
  | "connecting"
  | "error"
  | "reconnecting"
  | "keep-alive";
