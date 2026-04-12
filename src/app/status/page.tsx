import { redirect } from "next/navigation";

/** Old path; canonical settings live at `/settings`. */
export default function StatusRedirectPage() {
  redirect("/settings");
}
