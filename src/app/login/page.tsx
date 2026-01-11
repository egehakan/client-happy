import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-8">
        <LoginForm />
      </main>
    </div>
  );
}
