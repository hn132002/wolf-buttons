export const hasAdminAccess = (secret: string | undefined, given: string | null) =>
  Boolean(secret && given === secret);

export const getAdminFailureStatus = (given: string | null) => (given ? 403 : 401);
