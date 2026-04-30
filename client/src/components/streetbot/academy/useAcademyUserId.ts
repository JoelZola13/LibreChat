import { useMemo } from "react";
import { useAuthContext } from "~/hooks/AuthContext";
import { getOrCreateUserId, resolveAcademyUserId, type AcademyAuthUser } from "./api/userId";

export function useAcademyUserId(): string {
  const { user } = useAuthContext();

  return useMemo(() => {
    const authUserId = resolveAcademyUserId(user as AcademyAuthUser);
    return getOrCreateUserId(authUserId);
  }, [user]);
}
