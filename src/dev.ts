// Nest watches this entrypoint and compiles both services before starting them.
// Keep it independent of provider barrels until each child starts.
import { runDevelopment } from './config/development.js';

try {
  process.exitCode = await runDevelopment();
} catch {
  console.error('[Development] Invalid environment configuration. Check .env.');
  process.exitCode = 1;
}
