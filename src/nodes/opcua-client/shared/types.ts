export enum OpcuaClientActionEnum {
  READ = "read",
  WRITE = "write",
  READ_MULTIPLE = "read-multiple",
  WRITE_MULTIPLE = "write-multiple",
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
