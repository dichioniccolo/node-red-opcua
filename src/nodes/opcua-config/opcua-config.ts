import { NodeInitializer } from "node-red";
import { OpcuaConfigNode, OpcuaConfigNodeDef } from "./modules/types";
import mustache from "mustache";
import { OpcuaConfigCredentialsOptions } from "./shared/types";

const nodeInit: NodeInitializer = (RED): void => {
  function OpcuaConfigNodeConstructor(
    this: OpcuaConfigNode,
    config: OpcuaConfigNodeDef
  ): void {
    RED.nodes.createNode(this, config);

    const endpointRaw = config.endpoint;

    this.endpoint = mustache.render(endpointRaw, process.env);
    this.securityPolicy = config.securityPolicy;
    this.securityMode = config.securityMode;

    this.mode = this.credentials?.mode ?? "anonymous";

    if (this.mode === "username") {
      this.username = this.credentials?.username ?? "";
      this.password = this.credentials?.password ?? "";
    } else if (this.mode === "certificate") {
      this.certificate = this.credentials?.certificate ?? "";
      this.privateKey = this.credentials?.privateKey ?? "";
    }
  }

  RED.nodes.registerType<
    OpcuaConfigNode,
    OpcuaConfigNodeDef,
    unknown,
    OpcuaConfigCredentialsOptions
  >("opcua-config", OpcuaConfigNodeConstructor, {
    credentials: {
      mode: { type: "text" },
      username: { type: "text" },
      password: { type: "password" },
      certificate: { type: "text" },
      privateKey: { type: "password" },
    },
  });
};

export = nodeInit;
