import { createApplication } from '@/bootstrap/application.js';

const { app, environment } = await createApplication();
await app.listen(environment.PORT, '0.0.0.0');
