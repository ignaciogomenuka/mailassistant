"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { InviteMemberModal } from "@/components/InviteMemberModal";
import { useOrganizationId } from "@/hooks/useOrganizationId";

export function TeamSection() {
  const organizationId = useOrganizationId();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  return (
    <>
      <Item size="sm">
        <ItemContent>
          <ItemTitle>Invite members</ItemTitle>
          <ItemDescription>
            Share your plan by inviting teammates to your organization.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsInviteDialogOpen(true)}
          >
            Invite
          </Button>
        </ItemActions>
      </Item>

      <InviteMemberModal
        organizationId={organizationId}
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        trigger={null}
      />
    </>
  );
}
