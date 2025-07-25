# node-red-contrib-capgemini-opcua

A Node-RED node set for connecting to OPC UA servers, reading and writing node values, and supporting multiple authentication modes (anonymous, username/password, certificate).

## Features

- **OPC UA Client Node**: Read and write single or multiple node values.
- **Authentication**: Supports anonymous, username/password, and certificate-based authentication.
- **Configurable Security**: Choose security policy and mode.
- **Session Management**: Automatic session creation, keep-alive, and reconnection handling.
- **Error Handling**: Node status and error reporting for all actions.

## Nodes

### OPC UA Client

- **Actions**:
  - `read`: Read a single node value.
  - `write`: Write a value to a single node.
  - `read-multiple`: Read multiple node values.
  - `write-multiple`: Write values to multiple nodes.

- **Inputs**:
  - `topic`: NodeId for single read/write.
  - `payload`: Value for write, or array of nodes for multiple actions.
  - `dataType`: (Optional) Data type for single write actions.
  - `action`: (Optional) Override node action.

- **Outputs**:
  - First output: Result of the OPC UA operation.
  - Second output: Status and error messages.

### OPC UA Config

- **Endpoint**: OPC UA server endpoint URL.
- **Security Policy & Mode**: Select from supported OPC UA security options.
- **Authentication**: Configure anonymous, username/password, or certificate credentials.

## Usage

1. Add an **opcua-config** node and configure your server endpoint, security, and credentials.
2. Add an **opcua-client** node, link it to your config, and select the desired action.
3. Inject messages with the required properties (`topic`, `payload`, `dataType`, etc.) to perform OPC UA operations.

### OPC Ua Enum Data Type
```typescript

enum DataType {
  Null = 0,
  Boolean = 1,
  SByte = 2,// signed Byte = Int8
  Byte = 3,// unsigned Byte = UInt8
  Int16 = 4,
  UInt16 = 5,
  Int32 = 6,
  UInt32 = 7,
  Int64 = 8,
  UInt64 = 9,
  Float = 10,
  Double = 11,
  String = 12,
  DateTime = 13,
  Guid = 14,
  ByteString = 15,
  XmlElement = 16,
  NodeId = 17,
  ExpandedNodeId = 18,
  StatusCode = 19,
  QualifiedName = 20,
  LocalizedText = 21,
  ExtensionObject = 22,
  DataValue = 23,
  Variant = 24,
  DiagnosticInfo = 25
}

```