import { EditorNodeProperties } from "node-red";
import { OpcuaConfigOptions } from "../../shared/types";

export type OpcuaConfigEditorNodeProperties = EditorNodeProperties &
  OpcuaConfigOptions;
