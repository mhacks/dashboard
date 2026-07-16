import {
  INVITE_PAGE_SIZE,
  listUserInvites,
} from "@/lib/queries/user-invitations";
import TeamManagement from "./team-management";

export default async function AdminTeamPage() {
  const invites = await listUserInvites(0, INVITE_PAGE_SIZE);

  return <TeamManagement initialInvites={invites} />;
}
