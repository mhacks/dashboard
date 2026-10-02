import BouquetBuilder from "@/components/bouquet/BouquetBuilder";
import { getBouquetSharer } from "@/lib/actions/bouquet.actions";
import { getSessionUser } from "@/lib/auth/session";

export default async function Page() {
  // The proxy already requires a session here; a missing one just means no
  // share button, not an error page.
  const user = await getSessionUser();
  const { allowed } = user
    ? await getBouquetSharer(user.id)
    : { allowed: false };
  return <BouquetBuilder canShare={allowed} />;
}
