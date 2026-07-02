export const hasAdminAccess = (secret: string | undefined, given: string | null) =>
  Boolean(secret && given === secret);
