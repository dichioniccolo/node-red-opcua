import * as Schema from "effect/Schema";
import { DataType } from "node-opcua";

export enum OpcuaClientActionEnum {
  READ = "read",
  WRITE = "write",
}

export const OpcuaClientAction = Schema.Enums(OpcuaClientActionEnum);

export type OpcuaClientAction = typeof OpcuaClientAction.Type;

export interface OpcuaClientOptions {
  config?: string;
  action?: OpcuaClientAction;
}

export const OpcuaClientStatus = Schema.Union(
  Schema.Literal("connected"),
  Schema.Literal("disconnected"),
  Schema.Literal("connecting"),
  Schema.Literal("error"),
  Schema.Literal("reconnecting")
);

export type OpcuaClientStatus = typeof OpcuaClientStatus.Type;

export const DataTypeSchema = Schema.Enums(DataType);

export type DataTypeSchema = typeof DataTypeSchema.Type;
