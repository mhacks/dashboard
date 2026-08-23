import { redirect } from "next/navigation";

/**
 * The organizer hub moved to /dashboard, which lists these same tools as tiles
 * under an "Organizer tools" heading — so there is no longer a separate admin
 * landing UI to render.
 *
 * The route itself stays so old links and bookmarks still resolve rather than
 * 404. Everything under /admin/* is untouched; only this index redirects. Note
 * the layout's requireOrganizerPage() runs first, so a non-organizer is already
 * sent to /dashboard before reaching this.
 */
export default function AdminHomePage() {
  redirect("/dashboard");
}
