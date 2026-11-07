import { redirect } from "next/navigation";
import { Splash } from "@/components/Splash";
import { getViewer } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getViewer()) redirect("/");
  return (
    <Splash subtitle="Ryder Cup–style live scoring">
      <LoginForm />
      <p className="mt-auto text-center text-[13px] text-mist">No invite yet? Ask your organizer to add you.</p>
    </Splash>
  );
}
