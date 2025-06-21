import { NodeInitializer, NodeMessageInFlow, NodeStatus } from "node-red";
import { OpcuaClientNode, OpcuaClientNodeDef } from "./modules/types";
import { OpcuaConfigNode } from "../opcua-config/modules/types";
import {
  ByteString,
  ClientSession,
  DataType,
  OPCUAClient,
  UserIdentityInfo,
  UserTokenType,
} from "node-opcua";
import { OpcuaConfigOptions } from "../opcua-config/shared/types";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import {
  DataTypeSchema,
  OpcuaClientAction,
  OpcuaClientActionEnum,
  OpcuaClientStatus,
} from "./shared/types";

const nodeInit: NodeInitializer = (RED): void => {
  const connectionPool = new Map<
    string,
    {
      client: OPCUAClient;
      session: ClientSession | null;
    }
  >();

  function OpcuaClientNodeConstructor(
    this: OpcuaClientNode,
    config: OpcuaClientNodeDef
  ): void {
    RED.nodes.createNode(this, config);

    this.config = config.config
      ? (RED.nodes.getNode(config.config) as OpcuaConfigNode)
      : null;

    this.action = config.action;

    const sendOutput = (
      endpoint: string,
      output:
        | { value: any }
        | { status: { status: OpcuaClientStatus; error?: unknown } }
    ) => {
      if ("value" in output) {
        this.send([output.value, null]);
        return;
      }

      if ("status" in output) {
        this.send([null, output.status]);
        return;
      }
    };
    const sendNodeStatus = (
      endpoint: string,
      nodeStatus: NodeStatus,
      status: OpcuaClientStatus,
      error?: unknown
    ) => {
      this.status(nodeStatus);

      sendOutput(endpoint, {
        status: {
          status,
          error,
        },
      });
    };

    const onReestablished = (endpoint: string) => {
      sendNodeStatus(
        endpoint,
        {
          fill: "green",
          shape: "dot",
          text: "Connection reestablished",
        },
        "connected"
      );
    };

    const onBackoff = (endpoint: string, count: number, delay: number) => {
      sendNodeStatus(
        endpoint,
        {
          fill: "yellow",
          shape: "ring",
          text: `Reconnecting in ${delay / 1000}s (attempt ${count})`,
        },
        "reconnecting"
      );
    };

    const onStartReconnection = (endpoint: string) => {
      sendNodeStatus(
        endpoint,
        {
          fill: "yellow",
          shape: "ring",
          text: "Starting reconnection",
        },
        "reconnecting"
      );
    };

    const onSessionClosed = (endpoint: string) => {
      const connection = connectionPool.get(endpoint);

      if (connection) {
        connection.session = null;
      }

      sendOutput(endpoint, {
        status: {
          status: "disconnected",
          error: `Session closed for endpoint: ${endpoint}`,
        },
      });
    };

    const onSessionKeepAlive = (endpoint: string) => {
      sendNodeStatus(
        endpoint,
        {
          fill: "green",
          shape: "dot",
          text: "Session keep-alive",
        },
        "connected"
      );
      sendOutput(endpoint, {
        status: {
          status: "connected",
        },
      });
    };

    this.on("close", async (removed: boolean, done: () => void) => {
      for (const [_endpoint, { client, session }] of connectionPool) {
        if (session) {
          try {
            await session.close();

            session.removeAllListeners();

            this.log("Session closed successfully");
          } catch (err) {
            this.error("Error closing session");
          }
        }

        if (client) {
          try {
            await client.disconnect();

            client.removeAllListeners();

            this.log("Client disconnected successfully");
          } catch (err) {
            this.error("Error disconnecting client");
          }
        }
      }

      this.status({
        fill: "grey",
        shape: "ring",
        text: "Disconnected",
      });
      done();
    });

    const onActionRead = async (
      endpoint: string,
      session: ClientSession,
      msg: NodeMessageInFlow & {
        dataType: DataTypeSchema;
        topic: string;
      }
    ): Promise<void> => {
      if (!msg.topic) {
        this.error("No topic specified for read action", msg);
        return;
      }

      try {
        const dataValue = await session.read({
          nodeId: msg.topic,
        });

        sendOutput(endpoint, {
          value: {
            topic: msg.topic,
            payload: dataValue.value.value,
            dataType: dataValue.value.dataType,
          },
        });
      } catch (err) {
        sendOutput(endpoint, {
          status: {
            status: "error",
            error: `Error reading from node ${msg.topic}: ${err}`,
          },
        });
      }
    };

    const onActionWrite = async (
      endpoint: string,
      session: ClientSession,
      msg: NodeMessageInFlow & {
        dataType: DataTypeSchema;
        topic: string;
        payload: any;
      }
    ): Promise<void> => {
      if (!msg.topic) {
        this.error("No topic specified for write action", msg);
        return;
      }

      if (msg.payload === undefined || msg.payload === null) {
        this.error("No payload specified for write action", msg);
        return;
      }

      try {
        await session.write({
          nodeId: msg.topic,
          attributeId: 13, // Value attribute
          value: {
            value: {
              value: msg.payload,
              dataType: msg.dataType || DataType.String, // Default to String if not specified
            },
          },
        });
      } catch (err) {
        sendOutput(endpoint, {
          status: {
            status: "error",
            error: `Error writing to node ${msg.topic}: ${err}`,
          },
        });
      }
    };

    this.on(
      "input",
      async (
        msg: NodeMessageInFlow & {
          opcuaConfig?: OpcuaConfigOptions | null;
          action?: OpcuaClientAction;
          dataType?: DataTypeSchema | null;
          topic?: string;
          payload?: any;
        }
        // _send,
        // done
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

        const endpoint = opcuaConfig.value.endpoint;

        if (!endpoint) {
          this.error("No endpoint specified in OPC UA config", msg);
          return;
        }

        const connection = connectionPool.get(endpoint);

        let client = connection?.client ?? null;
        let session = connection?.session ?? null;

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

          await client.connect(endpoint);

          connectionPool.set(endpoint, {
            client,
            session: null,
          });

          client.on("connection_reestablished", () =>
            onReestablished(endpoint)
          );
          client.on("backoff", (count, delay) =>
            onBackoff(endpoint, count, delay)
          );
          client.on("start_reconnection", () => onStartReconnection(endpoint));
        }

        const existingSession = connectionPool.get(endpoint)?.session;

        if (existingSession) {
          session = existingSession;
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

          session.on("keepalive", onSessionKeepAlive);
          session.on("session_closed", onSessionClosed);

          connectionPool.set(opcuaConfig.value.endpoint, {
            client,
            session,
          });
        }

        const action = msg.action ?? this.action;

        if (!action) {
          this.error("No action specified", msg);
          return;
        }

        const dataTypeOption = Schema.decodeUnknownOption(DataTypeSchema)(
          msg.dataType
        );

        if (Option.isNone(dataTypeOption)) {
          this.error("Invalid data type specified", msg);
          return;
        }

        const dataType = dataTypeOption.value;
        const topic = msg.topic;

        if (!topic) {
          this.error("No topic specified", msg);
          return;
        }

        if (action === OpcuaClientActionEnum.READ) {
          onActionRead(endpoint, session, {
            ...msg,
            topic,
            dataType,
          });
        } else if (action === OpcuaClientActionEnum.WRITE) {
          onActionWrite(endpoint, session, {
            ...msg,
            topic,
            dataType,
            payload: msg.payload,
          });
        }
      }
    );
  }

  RED.nodes.registerType("opcua-client", OpcuaClientNodeConstructor);
};

export = nodeInit;
