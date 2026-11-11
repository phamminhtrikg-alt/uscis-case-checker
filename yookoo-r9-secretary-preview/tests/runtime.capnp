using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name = "production-load", worker = (modules = [(name = "worker.js", esModule = embed "../worker.js")],compatibilityDate = "2026-11-01",globalOutbound = "mock-network")),
  (name = "tests", worker = (
   modules = [(name = "tests/runtime.mjs", esModule = embed "runtime.mjs"),(name = "worker.js", esModule = embed "../worker.js")],
   compatibilityDate = "2026-11-01",globalOutbound = "mock-network",
   bindings = [(name = "COORD",durableObjectNamespace = (className = "RuntimeCoordinator")),(name = "TELEGRAM_BOT_TOKEN",text = "runtime-only"),(name = "TELEGRAM_CHAT_ID",text = "1")],
   durableObjectNamespaces = [(className = "RuntimeCoordinator",uniqueKey = "test-only-secretary",enableSql = true)],durableObjectStorage = (inMemory = void)
  )),
  (name = "mock-network",worker = (modules = [(name = "tests/runtime-network.mjs",esModule = embed "runtime-network.mjs"),(name = "tests/fixture.json",json = embed "../evidence/live-source-1.txt")],compatibilityDate = "2026-11-01"))
 ]
);
