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
  ClientSubscription,
} from "node-opcua";
import { OpcuaConfigOptions } from "../opcua-config/shared/types";
import { OpcuaClientActionEnum, OpcuaClientStatus } from "./shared/types";

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
        this.send([{ endpoint, payload: output.value }, null]);
        return;
      }

      if ("status" in output) {
        this.send([null, { endpoint, status: output.status }]);
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

    const onConnectionLost = (endpoint: string) => {
      const connection = connectionPool.get(endpoint);

      if (connection) {
        connection.session = null;
      }

      sendNodeStatus(
        endpoint,
        {
          fill: "red",
          shape: "ring",
          text: "Connection lost",
        },
        "disconnected"
      );
    };

    const onSessionKeepAlive = (endpoint: string) => {
      sendNodeStatus(
        endpoint,
        {
          fill: "green",
          shape: "dot",
          text: "Session keep-alive",
        },
        "keep-alive"
      );
      // sendOutput(endpoint, {
      //   status: {
      //     status: "connected",
      //   },
      // });
    };

    this.on("close", async (removed: boolean, done: () => void) => {
      for (const [endpoint, { client, session }] of connectionPool) {
        if (session) {
          try {
            await session.close();

            session.removeAllListeners();

            this.log(`${endpoint} session closed successfully`);
          } catch (err) {
            this.error(`Error closing session for endpoint ${endpoint}`);
          }
        }

        if (client) {
          try {
            await client.disconnect();

            client.removeAllListeners();

            this.log(`${endpoint} client disconnected successfully`);
          } catch (err) {
            this.error(`Error disconnecting client for endpoint ${endpoint}`);
          }
        }

        sendNodeStatus(
          endpoint,
          {
            fill: "grey",
            shape: "ring",
            text: "Disconnected",
          },
          "disconnected"
        );
      }

      connectionPool.clear();

      done();
    });

    const onActionRead = async (
      endpoint: string,
      session: ClientSession,
      msg: NodeMessageInFlow & {
        dataType: DataType;
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
        dataType: DataType;
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

      if (!msg.dataType) {
        this.error("No data type specified for write action", msg);
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
          action?: OpcuaClientActionEnum;
          dataType?: DataType | null;
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

        const opcuaConfig = (this.config ??
          msg.opcuaConfig) as OpcuaConfigOptions;

        const endpoint = opcuaConfig.endpoint;

        if (!endpoint) {
          this.error("No endpoint specified in OPC UA config", msg);
          return;
        }

        const connection = connectionPool.get(endpoint);

        let client = connection?.client ?? null;
        let session = connection?.session ?? null;

        if (!client) {
          const localClient = OPCUAClient.create({
            connectionStrategy: {
              maxRetry: Infinity,
              initialDelay: 5 * 1000,
              maxDelay: 30 * 1000,
            },
            securityPolicy: opcuaConfig.securityPolicy,
            securityMode: opcuaConfig.securityMode,
            clientName: this.name,
            endpointMustExist: false,
            keepSessionAlive: true, // Opcua already handles session keep-alive
            keepAliveInterval: 3 * 1000,
          });

          try {
            await localClient.connect(endpoint);
          } catch (e) {
            this.error(e, msg);

            return;
          }

          localClient.on("connection_reestablished", () =>
            onReestablished(endpoint)
          );
          localClient.on("backoff", (count, delay) =>
            onBackoff(endpoint, count, delay)
          );
          localClient.on("start_reconnection", () =>
            onStartReconnection(endpoint)
          );
          localClient.on("connection_lost", () => onConnectionLost(endpoint));

          client = localClient;

          connectionPool.set(endpoint, {
            client,
            session: null,
          });
        }

        if (!client) {
          return;
        }

        const existingSession = connectionPool.get(endpoint)?.session;

        if (existingSession) {
          session = existingSession;
        }

        if (!session) {
          let userIdentity: UserIdentityInfo;

          if (opcuaConfig.mode === "username") {
            userIdentity = {
              type: UserTokenType.UserName,
              userName: opcuaConfig.username,
              password: opcuaConfig.password,
            };
          } else if (opcuaConfig.mode === "certificate") {
            userIdentity = {
              type: UserTokenType.Certificate,
              certificateData: opcuaConfig.certificate as unknown as ByteString,
              privateKey: opcuaConfig.privateKey,
            };
          } else {
            userIdentity = {
              type: UserTokenType.Anonymous,
            };
          }

          try {
            session = await client.createSession(userIdentity);
          } catch (e) {
            this.error(e, msg);

            return;
          }

          session.on("keepalive", () => onSessionKeepAlive(endpoint));
          session.on("session_closed", () => onSessionClosed(endpoint));

          connectionPool.set(opcuaConfig.endpoint, {
            client,
            session,
          });

          sendNodeStatus(
            endpoint,
            {
              fill: "green",
              shape: "dot",
              text: "Connected",
            },
            "connected"
          );
        }

        const action = msg.action ?? this.action;

        if (!action) {
          this.error("No action specified", msg);
          return;
        }

        const dataType = msg.dataType as DataType;

        const topic = msg.topic;

        if (!topic) {
          this.error("No topic specified", msg);
          return;
        }

        if (action === OpcuaClientActionEnum.READ) {
          await onActionRead(endpoint, session, {
            ...msg,
            topic,
            dataType,
          });
        } else if (action === OpcuaClientActionEnum.WRITE) {
          await onActionWrite(endpoint, session, {
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
