import { EditorNodeProperties } from "node-red";
import { OpcuaClientOptions } from "../../shared/types";

export interface OpcuaClientEditorNodeProperties
  extends EditorNodeProperties,
    OpcuaClientOptions {}
