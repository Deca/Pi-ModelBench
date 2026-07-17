// Parse process-style string configuration.
// Defaults: port 3000, retries 3, debug false.
// Valid values: port is an integer from 1 through 65535; retries is an integer from 0 through 10;
// debug accepts the strings "true" and "false". Invalid values must throw TypeError.
export function parseConfig(input = {}) {
  return {
    port: Number(input.port ?? 3000),
    retries: Number(input.retries ?? 3),
    debug: input.debug === "true"
  };
}
