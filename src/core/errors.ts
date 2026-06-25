export class ITOSError extends Error {
  readonly errorId:       string;
  readonly service:       string;
  readonly correlationId: string;
  readonly ts:            string;

  constructor(
    message: string,
    errorId: string,
    service = 'unknown',
    correlationId = '',
  ) {
    super(message);
    this.name          = 'ITOSError';
    this.errorId       = errorId;
    this.service       = service;
    this.correlationId = correlationId;
    this.ts            = new Date().toISOString();
  }
}

export class ValidationError extends ITOSError {
  constructor(message: string, correlationId = '') {
    super(message, 'ITOS-1001', 'api-gateway', correlationId);
    this.name = 'ValidationError';
  }
}

export class AuthError extends ITOSError {
  constructor(message: string, correlationId = '') {
    super(message, 'ITOS-1002', 'api-gateway', correlationId);
    this.name = 'AuthError';
  }
}

export class RiskRejectedError extends ITOSError {
  readonly gate: string;
  constructor(message: string, gate: string, correlationId = '') {
    const id = gate === 'KILL_SWITCH' ? 'ITOS-2001'
             : gate === 'GRADE'       ? 'ITOS-2002'
             : gate === 'RR'          ? 'ITOS-2003'
             :                          'ITOS-2004';
    super(message, id, 'risk', correlationId);
    this.name = 'RiskRejectedError';
    this.gate = gate;
  }
}

export class MemoryBlockedError extends ITOSError {
  readonly reason: string;
  constructor(message: string, reason: string, correlationId = '') {
    const id = reason === 'COOLDOWN'     ? 'ITOS-3001'
             : reason === 'FINGERPRINT'  ? 'ITOS-3002'
             :                             'ITOS-3003';
    super(message, id, 'memory', correlationId);
    this.name = 'MemoryBlockedError';
    this.reason = reason;
  }
}

export class ProviderError extends ITOSError {
  constructor(message: string, correlationId = '') {
    super(message, 'ITOS-4001', 'market', correlationId);
    this.name = 'ProviderError';
  }
}

export class AllProvidersFailedError extends ITOSError {
  constructor(message: string, correlationId = '') {
    super(message, 'ITOS-4002', 'market', correlationId);
    this.name = 'AllProvidersFailedError';
  }
}

export class DatabaseError extends ITOSError {
  constructor(message: string, subtype: 'timeout' | 'query' = 'query', correlationId = '') {
    super(message, subtype === 'timeout' ? 'ITOS-5001' : 'ITOS-5002', 'database', correlationId);
    this.name = 'DatabaseError';
  }
}
