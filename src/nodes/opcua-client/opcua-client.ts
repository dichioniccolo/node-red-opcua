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
  AttributeIds,
} from "node-opcua";
import { OpcuaConfigOptions } from "../opcua-config/shared/types";
import { OpcuaClientActionEnum, OpcuaClientStatus } from "./shared/types";

class NodeRedOpcuaConnection {
  private session: ClientSession | null = null;

  private subscriptions: Map<string, ClientSubscription> = new Map();

  constructor(
    public endpoint: string,
    public client: OPCUAClient
  ) {
    // client.on("session_closed", () => {
    //   this.session = null;
    // });
    // client.on("connection_reestablished", () => {
    //   this.session = null; // Reset session on reconnection
    // });
  }

  public async disconnect() {
    await this.client.disconnect();
  }

  public async createSession(userIdentityInfo: UserIdentityInfo) {
    if (this.session) {
      return this.session;
    }

    this.session = await this.client.createSession(userIdentityInfo);

    return this.session;
  }

  public getSession(): ClientSession {
    if (!this.session) {
      throw new Error("Session not created yet");
    }

    return this.session;
  }

  public async destroySession() {
    if (!this.session) {
      return;
    }

    try {
      this.session.removeAllListeners();

      await this.session.close();
    } finally {
      this.session = null;
    }
  }

  public async read(nodeId: string) {
    if (!this.session) {
      throw new Error("Session not created yet");
    }

    const dataValue = await this.session.read({
      nodeId,
    });

    return {
      value: dataValue.value.value,
      dataType: dataValue.value.dataType,
    };
  }

  public async write(
    nodeId: string,
    value: any,
    dataType: DataType = DataType.String
  ) {
    if (!this.session) {
      throw new Error("Session not created yet");
    }

    await this.session.write({
      nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          value,
          dataType,
        },
      },
    });
  }

  public async writeMultiple(
    nodes: Array<{
      nodeId: string;
      value: any;
      dataType: DataType;
    }>
  ) {
    if (!this.session) {
      throw new Error("Session not created yet");
    }

    const writeValues = nodes.map((node) => ({
      nodeId: node.nodeId,
      attributeId: AttributeIds.Value,
      value: {
        value: {
          value: node.value,
          dataType: node.dataType,
        },
      },
    }));

    await this.session.write(writeValues);
  }

  public async readMultiple(
    nodes: Array<{
      nodeId: string;
      dataType: DataType;
    }>
  ) {
    if (!this.session) {
      throw new Error("Session not created yet");
    }

    const readValues = nodes.map((node) => ({
      nodeId: node.nodeId,
      attributeId: AttributeIds.Value,
    }));

    const dataValues = await this.session.read(readValues);

    return dataValues.map((dataValue, index) => ({
      nodeId: nodes[index].nodeId,
      value: dataValue.value.value,
      dataType: dataValue.value.dataType,
    }));
  }
}

const nodeInit: NodeInitializer = (RED): void => {
  const connectionPool = new Map<string, NodeRedOpcuaConnection>();

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

    const onSessionClosed = async (endpoint: string) => {
      const connection = connectionPool.get(endpoint);

      if (!connection) {
        return;
      }

      await connection.destroySession();

      sendOutput(endpoint, {
        status: {
          status: "disconnected",
          error: `Session closed for endpoint: ${endpoint}`,
        },
      });
    };

    const onConnectionLost = async (endpoint: string) => {
      const connection = connectionPool.get(endpoint);

      if (!connection) {
        return;
      }

      await connection.destroySession();

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
      for (const [endpoint, connection] of connectionPool) {
        await connection.destroySession();
        await connection.disconnect();

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
      connection: NodeRedOpcuaConnection,
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
        const dataValue = await connection.read(msg.topic);

        sendOutput(endpoint, {
          value: {
            topic: msg.topic,
            payload: dataValue.value,
            dataType: dataValue.dataType,
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
      connection: NodeRedOpcuaConnection,
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
        await connection.write(msg.topic, msg.payload, msg.dataType);
      } catch (err) {
        sendOutput(endpoint, {
          status: {
            status: "error",
            error: `Error writing to node ${msg.topic}: ${err}`,
          },
        });
      }
    };

    const onActionReadMultiple = async (
      endpoint: string,
      connection: NodeRedOpcuaConnection,
      msg: NodeMessageInFlow & {
        payload: Array<{ nodeId: string; dataType?: DataType }>;
      }
    ): Promise<void> => {
      if (!Array.isArray(msg.payload) || msg.payload.length === 0) {
        this.error("No payload specified for read-multiple action", msg);
        return;
      }

      const nodes = msg.payload.map((node) => ({
        nodeId: node.nodeId,
        dataType: node.dataType || DataType.String,
      }));

      try {
        const values = await connection.readMultiple(nodes);

        sendOutput(endpoint, {
          value: values.map((value) => ({
            topic: value.nodeId,
            payload: value.value,
            dataType: value.dataType,
          })),
        });
      } catch (err) {
        sendOutput(endpoint, {
          status: {
            status: "error",
            error: `Error reading multiple nodes: ${err}`,
          },
        });
      }
    };

    const onActionWriteMultiple = async (
      endpoint: string,
      connection: NodeRedOpcuaConnection,
      msg: NodeMessageInFlow & {
        payload: Array<{ nodeId: string; value: any; dataType: DataType }>;
      }
    ): Promise<void> => {
      if (
        !Array.isArray(msg.payload) ||
        msg.payload.length === 0 ||
        !msg.payload.every(
          (node) => node.nodeId && node.value !== undefined && node.dataType
        )
      ) {
        this.error("Invalid payload for write-multiple action", msg);
        return;
      }

      const nodes = msg.payload.map((node) => ({
        nodeId: node.nodeId,
        value: node.value,
        dataType: node.dataType,
      }));

      try {
        await connection.writeMultiple(nodes);
      } catch (err) {
        sendOutput(endpoint, {
          status: {
            status: "error",
            error: `Error writing multiple nodes: ${err}`,
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

        let connection = connectionPool.get(endpoint);

        if (!connection) {
          const client = OPCUAClient.create({
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
            await client.connect(endpoint);
          } catch (e) {
            this.error(e, msg);

            return;
          }

          client.on("connection_reestablished", () =>
            onReestablished(endpoint)
          );
          client.on("backoff", (count, delay) =>
            onBackoff(endpoint, count, delay)
          );
          client.on("start_reconnection", () => onStartReconnection(endpoint));
          client.on("connection_lost", () => onConnectionLost(endpoint));

          const localConnection = new NodeRedOpcuaConnection(endpoint, client);

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

          const session = await localConnection.createSession(userIdentity);

          session.on("keepalive", () => onSessionKeepAlive(endpoint));
          session.on("session_closed", () => onSessionClosed(endpoint));

          connectionPool.set(endpoint, localConnection);

          connection = localConnection;

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
          await onActionRead(endpoint, connection, {
            ...msg,
            topic,
            dataType,
          });
        } else if (action === OpcuaClientActionEnum.WRITE) {
          await onActionWrite(endpoint, connection, {
            ...msg,
            topic,
            dataType,
            payload: msg.payload,
          });
        } else if (action === OpcuaClientActionEnum.READ_MULTIPLE) {
          await onActionReadMultiple(endpoint, connection, {
            ...msg,
            payload: msg.payload,
          });
        } else if (action === OpcuaClientActionEnum.WRITE_MULTIPLE) {
          await onActionWriteMultiple(endpoint, connection, {
            ...msg,
            payload: msg.payload,
          });
        }
      }
    );
  }

  RED.nodes.registerType("opcua-client", OpcuaClientNodeConstructor);
};

export = nodeInit;
