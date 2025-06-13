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

    this.type = config.type;

    if (config.type === "username" && this.type === config.type) {
      this.username = config.username;
      this.password = config.password;
    } else if (config.type === "certificate" && this.type === config.type) {
      this.certificate = config.certificate;
      this.privateKey = config.privateKey;
    }
  }

  RED.nodes.registerType("opcua-config", OpcuaConfigNodeConstructor);
};

export = nodeInit;
