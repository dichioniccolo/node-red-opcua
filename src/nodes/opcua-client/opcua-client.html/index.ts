import { EditorRED } from "node-red";
import { OpcuaClientEditorNodeProperties } from "./modules/types";

declare const RED: EditorRED;

RED.nodes.registerType<OpcuaClientEditorNodeProperties>("opcua-client", {
  category: "function",
  color: "#a6bbcf",
  defaults: {
    name: { value: "" },
  },
  inputs: 1,
  outputs: 1,
  icon: "file.png",
  paletteLabel: "opcua client",
  label: function () {
    return this.name || "opcua client";
  },
});
