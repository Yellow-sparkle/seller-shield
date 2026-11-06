// The health scan moved to the home page. Old /scan links still work.
import { redirect } from "next/navigation";

export default function ScanRedirect() {
  redirect("/");
}
