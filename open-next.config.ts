import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

config.buildCommand = "npx prisma generate && npx next build";
config.cloudflare = {
  useWorkerdCondition: false,
};

export default config;
