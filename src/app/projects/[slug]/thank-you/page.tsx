"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { Progress } from "@/components/ui/progress";

export default function ThankYouPage() {
  const router = useRouter();
  const params = useParams();
  const [countdown, setCountdown] = useState(5);
  const hasRedirected = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Handle redirect separately when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push(`/projects/${params.slug}`);
    }
  }, [countdown, router, params.slug]);

  const progress = ((5 - countdown) / 5) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <Logo />
          </div>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Thank You!</CardTitle>
          <CardDescription className="text-base">
            Your feedback has been submitted successfully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We appreciate you taking the time to share your style preferences.
            Your input will help us create a design that matches your vision.
          </p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
            </p>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
