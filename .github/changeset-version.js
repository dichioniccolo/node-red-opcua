const { exec } = require("child_process");
exec("pnpm changeset version");
exec("pnpm install");
