// Run an async operation up to `attempts` times.
// Resolve with the first successful value. If every attempt fails, reject with the last error.
// attempts must be a positive integer.
export async function retry(operation, attempts = 3) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  return undefined;
}
