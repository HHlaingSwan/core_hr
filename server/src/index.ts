import { buildApp } from "./app";
import { config } from "./config/index";

async function main() {
  const app = buildApp();

  try {
    const address = await app.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`🚀 Omni HR Backend Server is running at: ${address}`);
    console.log(`   Healthcheck: ${address}/health`);
    console.log(`   API Base URL: ${address}/api`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
