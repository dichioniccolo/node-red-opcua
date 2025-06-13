import * as Schema from "effect/Schema";

export const SecurityPolicy = Schema.Union(
  Schema.Literal("Invalid"),
  Schema.Literal("None"),
  Schema.Literal("Basic128"),
  Schema.Literal("Basic192"),
  Schema.Literal("Basic192Rsa15"),
  Schema.Literal("Basic256Rsa15"),
  Schema.Literal("Basic256Sha256"),
  Schema.Literal("Aes128_Sha256_RsaOaep"),
  Schema.Literal("Aes256_Sha256_RsaPss"),
  Schema.Literal("PubSub_Aes128_CTR"),
  Schema.Literal("PubSub_Aes256_CTR"),
  Schema.Literal("Basic128Rsa15"),
  Schema.Literal("Basic256")
);

export const SecurityMode = Schema.Union(
  Schema.Literal("None"),
  Schema.Literal("Sign"),
  Schema.Literal("SignAndEncrypt")
);

const AnonymousSchema = Schema.Struct({
  type: Schema.Literal("anonymous"),
});

const UsernameSchema = Schema.Struct({
  type: Schema.Literal("username"),
  username: Schema.String,
  password: Schema.String,
});

const CertificateSchema = Schema.Struct({
  type: Schema.Literal("certificate"),
  certificate: Schema.String,
  privateKey: Schema.String,
});

export const OpcuaConfigOptions = Schema.Union(
  Schema.Struct({
    endpoint: Schema.String,
    securityPolicy: SecurityPolicy,
    securityMode: SecurityMode,
  })
).pipe(
  Schema.extend(
    Schema.Union(AnonymousSchema, UsernameSchema, CertificateSchema)
  )
);

export type OpcuaConfigOptions = typeof OpcuaConfigOptions.Type;
