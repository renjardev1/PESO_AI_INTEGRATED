// Web admin role constants
export const ROLES = {
  MAIN_ADMIN:  'Main Admin',
  STAFF_ADMIN: 'Staff Admin',
};

export const LOG_TYPES = {
  SUCCESS: 'SUCCESS',
  FAILED:  'FAILED',
  SYSTEM:  'SYSTEM',
};

export const HTTP = {
  OK:                200,
  BAD_REQUEST:       400,
  UNAUTHORIZED:      401,
  FORBIDDEN:         403,
  NOT_FOUND:         404,
  CONFLICT:          409,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL:          500,
};

export const AVATAR_MAX_SIZE  = 2_800_000;
export const PASSWORD_MIN_LEN = 8;
export const BCRYPT_ROUNDS    = 10;
export const LOG_LIMIT        = 100;
export const AUDIT_LIMIT      = 200;

export const SAVINGS_DISTRIBUTION_COLORS = {
  DEFICIT:  '#EF4444',
  LOW:      '#F59E0B',
  MODERATE: '#3B82F6',
  HIGH:     '#22C55E',
};
