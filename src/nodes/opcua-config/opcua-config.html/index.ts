import { EditorRED } from "node-red";
import { OpcuaConfigEditorNodeProperties } from "./modules/types";

declare const RED: EditorRED;

RED.nodes.registerType<OpcuaConfigEditorNodeProperties>("opcua-config", {
  category: "config",
  color: "#a6bbcf",
  defaults: {
    username: { value: "" },
    password: { type: "password", value: "" },
    certificate: { value: "" },
    privateKey: { type: "password", value: "" },
    endpoint: { value: "" },
    securityPolicy: { value: "None" },
    securityMode: { value: "None" },
    // @ts-expect-error ts
    type: { value: "anonymous" },
  },
  inputs: 1,
  outputs: 1,
  icon: "file.png",
  paletteLabel: "opcua config",
  label: function () {
    return this.name || "opcua config";
  },
});
