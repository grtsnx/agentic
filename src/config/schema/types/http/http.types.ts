import type { apiVersions } from '@/bootstrap';

export interface RequestWithId {
  headers: Record<string, string | string[] | undefined>;
  requestId?: string;
}

export interface ResponseWithHeader {
  setHeader(name: string, value: string): void;
}

export type ApiVersion = (typeof apiVersions)[number];
