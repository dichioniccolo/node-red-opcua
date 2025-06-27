import { EditorRED } from "node-red";
import { OpcuaClientEditorNodeProperties } from "./modules/types";

declare const RED: EditorRED;

RED.nodes.registerType<OpcuaClientEditorNodeProperties>("opcua-client", {
  category: "opcua",
  color: "#3FADB5",
  defaults: {
    name: { value: "" },
    config: {
      type: "opcua-config",
      required: false,
      value: "",
    },
    action: {
      required: false,
      value: "",
    },
  },
  inputs: 1,
  outputs: 2,
  icon: "bridge-dash.svg",
  paletteLabel: "opcua client",
  label: function () {
    return this.name || "opcua client";
  },
});
