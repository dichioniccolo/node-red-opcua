import { Node, NodeDef } from "node-red";
import { OpcuaConfigOptions } from "../shared/types";

export type OpcuaConfigNodeDef = NodeDef & OpcuaConfigOptions;

// export interface OpcuaConfigNode extends Node {}
export type OpcuaConfigNode = Node &
  OpcuaConfigOptions & {
    credentials: {
      username?: string;
      password?: string;
      certificate?: string;
      privateKey?: string;
    };
  };
