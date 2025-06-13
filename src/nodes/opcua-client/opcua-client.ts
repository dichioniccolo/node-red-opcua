import { NodeInitializer, NodeMessageInFlow, NodeStatus } from "node-red";
import { OpcuaClientNode, OpcuaClientNodeDef } from "./modules/types";
import { OpcuaConfigNode } from "../opcua-config/modules/types";
import {
  ByteString,
  ClientSession,
  crypto_utils,
  OPCUAClient,
  UserIdentityInfo,
  UserTokenType,
} from "node-opcua";
import { OpcuaConfigOptions } from "../opcua-config/shared/types";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import { OpcuaClientAction, OpcuaClientStatus } from "./shared/types";

const nodeInit: NodeInitializer = (RED): void => {
  function OpcuaClientNodeConstructor(
    this: OpcuaClientNode,
    config: OpcuaClientNodeDef
  ): void {
    RED.nodes.createNode(this, config);

    this.config = config.config
      ? (RED.nodes.getNode(config.config) as OpcuaConfigNode)
      : null;

    this.action = config.action;

    let client: OPCUAClient | null = null;
    let session: ClientSession | null = null;

    const sendOutput = ({
      value,
      status,
    }: {
      value?: any | null;
      status?: {
        status: OpcuaClientStatus;
        error?: unknown;
      } | null;
    }) => {
      this.send([value ?? null, status ?? null]);
    };

    const sendNodeStatus = (
      nodeStatus: NodeStatus,
      status: OpcuaClientStatus,
      error?: unknown
    ) => {
      this.status(nodeStatus);

      sendOutput({
        status: {
          status,
          error,
        },
      });
    };

    const onReestablished = () => {
      sendNodeStatus(
        {
          fill: "green",
          shape: "dot",
          text: "Connection reestablished",
        },
        "connected"
      );
    };

    const onBackoff = (count: number, delay: number) => {
      sendNodeStatus(
        {
          fill: "yellow",
          shape: "ring",
          text: `Reconnecting in ${delay / 1000}s (attempt ${count})`,
        },
        "reconnecting"
      );
    };

    const onStartReconnection = () => {
      sendNodeStatus(
        {
          fill: "yellow",
          shape: "ring",
          text: "Starting reconnection",
        },
        "reconnecting"
      );
    };

    const onSessionClosed = () => {
      session = null;
    };

    this.on("close", async (removed: boolean, done: () => void) => {
      if (session) {
        try {
          await session.close();

          session.removeListener("session_closed", onSessionClosed);

          session = null;

          this.log("Session closed successfully");
        } catch (err) {
          this.error("Error closing session");
        }
      }

      if (client) {
        try {
          await client.disconnect();

          client.removeListener("connection_reestablished", onReestablished);
          client.removeListener("backoff", onBackoff);
          client.removeListener("start_reconnection", onStartReconnection);

          client = null;

          this.log("Client disconnected successfully");
        } catch (err) {
          this.error("Error disconnecting client");
        }
      }

      this.status({
        fill: "grey",
        shape: "ring",
        text: "Disconnected",
      });
      done();
    });

    this.on(
      "input",
      async (
        msg: NodeMessageInFlow & {
          opcuaConfig?: OpcuaConfigOptions | null;
          action?: OpcuaClientAction;
          dataType?: string | null;
          topic?: string;
        },
        _send,
        done
      ) => {
        if (!this.config && !msg.opcuaConfig) {
          this.error("No OPC UA config node specified", msg);
          return;
        }

        const opcuaConfig = Schema.decodeUnknownOption(OpcuaConfigOptions)(
          this.config ?? msg.opcuaConfig
        );

        if (Option.isNone(opcuaConfig)) {
          this.error("Invalid OPC UA config", msg);
          return;
        }

        if (!client) {
          client = OPCUAClient.create({
            connectionStrategy: {
              maxRetry: Infinity,
              initialDelay: 5 * 1000,
              maxDelay: 30 * 1000,
            },
            securityPolicy: opcuaConfig.value.securityPolicy,
            securityMode: opcuaConfig.value.securityMode,
            clientName: this.name,
            endpointMustExist: false,
          });

          await client.connect(opcuaConfig.value.endpoint);

          client.on("connection_reestablished", onReestablished);
          client.on("backoff", onBackoff);
          client.on("start_reconnection", onStartReconnection);
        }

        if (!session) {
          let userIdentity: UserIdentityInfo;

          if (opcuaConfig.value.type === "username") {
            userIdentity = {
              type: UserTokenType.UserName,
              userName: opcuaConfig.value.username,
              password: opcuaConfig.value.password,
            };
          } else if (opcuaConfig.value.type === "certificate") {
            userIdentity = {
              type: UserTokenType.Certificate,
              certificateData: opcuaConfig.value
                .certificate as unknown as ByteString,
              privateKey: opcuaConfig.value.privateKey,
            };
          } else {
            userIdentity = {
              type: UserTokenType.Anonymous,
            };
          }

          session = await client.createSession(userIdentity);

          session.on("session_closed", onSessionClosed);
        }

        const action = msg.action ?? this.action;

        if (!action) {
          this.error("No action specified", msg);
          return;
        }

        // send(msg);
        done();
      }
    );
  }

  RED.nodes.registerType("opcua-client", OpcuaClientNodeConstructor);
};

export = nodeInit;
