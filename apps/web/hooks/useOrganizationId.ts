import { useAccount } from "@/providers/EmailAccountProvider";
import { useUser } from "@/hooks/useUser";

export function useOrganizationId() {
  const { emailAccountId, emailAccount } = useAccount();
  const { data: user } = useUser();
  const currentEmailAccountId = emailAccount?.id || emailAccountId;

  return user?.members?.find(
    (member) => member.emailAccountId === currentEmailAccountId,
  )?.organizationId;
}
