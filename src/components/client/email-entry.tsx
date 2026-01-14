"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Mail } from "lucide-react";
import { type Project } from "@/types";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EmailFormValues = z.infer<typeof emailSchema>;

interface EmailEntryProps {
  project: Project;
  onEmailSubmit: (email: string) => void;
}

export function EmailEntry({ project, onEmailSubmit }: EmailEntryProps) {
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    const stored = localStorage.getItem(`voting-email-${project.id}`);
    if (stored) {
      setSavedEmail(stored);
      form.setValue("email", stored);
    }
  }, [project.id, form]);

  function onSubmit(values: EmailFormValues) {
    localStorage.setItem(`voting-email-${project.id}`, values.email);
    onEmailSubmit(values.email);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-xl">{project.name}</h1>
            {project.description && (
              <p className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Logo className="flex-shrink-0" />
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 pb-20 sm:pb-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Enter Your Email</CardTitle>
            <CardDescription>
              Please enter your email address to start voting on design screenshots
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="you@example.com"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full">
                  Start Voting
                </Button>
              </form>
            </Form>
            {savedEmail && (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Previously voted as: {savedEmail}
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
