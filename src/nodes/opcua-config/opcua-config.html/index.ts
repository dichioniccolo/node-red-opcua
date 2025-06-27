import { EditorRED } from "node-red";
import { OpcuaConfigEditorNodeProperties } from "./modules/types";

declare const RED: EditorRED;

RED.nodes.registerType<
  OpcuaConfigEditorNodeProperties,
  {
    username: string;
    password: string;
    certificate: string;
    privateKey: string;
  }
>("opcua-config", {
  category: "config",
  defaults: {
    endpoint: { value: "" },
    securityPolicy: { value: "None" },
    securityMode: { value: "None" },
    mode: { value: "anonymous" },
  } as any,
  credentials: {
    username: { type: "text" },
    password: { type: "password" },
    certificate: { type: "text" },
    privateKey: { type: "text" },
  },
  label: function () {
    return this.endpoint || "OPCUa";
  },
  oneditprepare: function () {
    const credentialsRows = $(".node-input-credentials-row");
    const certificateRows = $(".node-input-certificate-row");

    const modeSelectElement = $("#node-config-input-mode");

    const setCredentialsValues = (username: string, password: string) => {
      $("#node-config-input-username").val(username);
      $("#node-config-input-password").val(password);
    };

    const setCertificateValues = (certificate: string, privateKey: string) => {
      $("#node-config-input-certificate").val(certificate);
      $("#node-config-input-privateKey").val(privateKey);
    };

    const handleModeChange = (mode: string) => {
      if (mode === "anonymous") {
        credentialsRows.hide();
        certificateRows.hide();

        setCredentialsValues("", "");
        setCertificateValues("", "");
      }

      if (mode === "certificate") {
        credentialsRows.hide();
        certificateRows.show();

        setCredentialsValues("", "");
      }

      if (mode === "username") {
        credentialsRows.show();
        certificateRows.hide();

        setCertificateValues("", "");
      }
    };

    modeSelectElement.on("change", (e) => {
      const mode = $(e.currentTarget).val() as string;

      handleModeChange(mode);
    });

    handleModeChange(this.mode);
  },
});
