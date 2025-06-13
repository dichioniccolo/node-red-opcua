import { Node, NodeDef } from "node-red";
import { OpcuaConfigOptions } from "../shared/types";
import { Mutable } from "effect/Types";

export type OpcuaConfigNodeDef = NodeDef & OpcuaConfigOptions;

export type OpcuaConfigNode = Node & Mutable<OpcuaConfigOptions>;
