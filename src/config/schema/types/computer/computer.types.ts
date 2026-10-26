import type { z } from 'zod';
import type {
  computerActionSchema,
  computerApprovedActionSchema,
  computerTargetSchema,
} from '../../computer/computer.schema.js';
export type ComputerAction = z.infer<typeof computerActionSchema>;
export type ComputerApprovedAction = z.infer<
  typeof computerApprovedActionSchema
>;
export type ComputerTarget = z.infer<typeof computerTargetSchema>;
export interface ComputerSnapshot {
  text: string;
  fingerprint: string;
  image?: string;
}
export interface ComputerObservation extends ComputerSnapshot {
  observationId: string;
  app: string | null;
}
export interface ComputerLease {
  id: string;
  scopeId: string;
  target: ComputerTarget;
  abort: AbortController;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
  detach: () => void;
  observation?: ComputerObservation;
  busy: boolean;
}
