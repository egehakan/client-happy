import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { Logo } from "@/components/logo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ThankYouPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
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
          <div className="pt-4">
            <Link href={`/projects/${slug}`}>
              <Button variant="outline">Submit Another Response</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
