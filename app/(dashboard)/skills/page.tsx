import { redirect } from "next/navigation";

export default function SkillsRedirectPage() {
  redirect("/resources?tab=skills");
}
