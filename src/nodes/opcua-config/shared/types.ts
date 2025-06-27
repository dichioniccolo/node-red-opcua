export type SecurityPolicy =
  | "Invalid"
  | "None"
  | "Basic128"
  | "Basic192"
  | "Basic192Rsa15"
  | "Basic256Rsa15"
  | "Basic256Sha256"
  | "Aes128_Sha256_RsaOaep"
  | "Aes256_Sha256_RsaPss"
  | "PubSub_Aes128_CTR"
  | "PubSub_Aes256_CTR"
  | "Basic128Rsa15"
  | "Basic256";

export type SecurityMode = "None" | "Sign" | "SignAndEncrypt";

type AnonymousSchema = {
  mode: "anonymous";
};

type UsernameSchema = {
  mode: "username";
  username: string;
  password: string;
};

type CertificateSchema = {
  mode: "certificate";
  certificate: string;
  privateKey: string;
};

export type OpcuaConfigOptions = {
  endpoint: string;
  securityPolicy: SecurityPolicy;
  securityMode: SecurityMode;
  credentials: OpcuaConfigCredentialsOptions;
} & (AnonymousSchema | UsernameSchema | CertificateSchema);

export type OpcuaConfigCredentialsOptions =
  | AnonymousSchema
  | UsernameSchema
  | CertificateSchema;
