// Keep this entrypoint independent of provider barrels until each child starts.
import { runDevelopment } from './config/development.js';

try {
  process.exitCode = await runDevelopment();
} catch {
  console.error('[Development] Invalid environment configuration. Check .env.');
  process.exitCode = 1;
}
