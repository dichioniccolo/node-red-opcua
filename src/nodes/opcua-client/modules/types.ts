import { Node, NodeDef } from "node-red";
import { OpcuaClientActionEnum, OpcuaClientOptions } from "../shared/types";
import { OpcuaConfigNode } from "src/nodes/opcua-config/modules/types";

export interface OpcuaClientNodeDef extends NodeDef, OpcuaClientOptions {}

// export interface OpcuaClientNode extends Node {}
export type OpcuaClientNode = Node & {
  config?: OpcuaConfigNode | null;
  action?: OpcuaClientActionEnum;
};
