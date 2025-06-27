import { NodeInitializer } from "node-red";
import { OpcuaConfigNode, OpcuaConfigNodeDef } from "./modules/types";
import mustache from "mustache";

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

    this.mode = config.mode;

    if (config.mode === "username" && this.mode === config.mode) {
      this.username = config.username;
      this.password = config.password;
    } else if (config.mode === "certificate" && this.mode === config.mode) {
      this.certificate = config.certificate;
      this.privateKey = config.privateKey;
    }
  }

  RED.nodes.registerType("opcua-config", OpcuaConfigNodeConstructor);
};

export = nodeInit;
