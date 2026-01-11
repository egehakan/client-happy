import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { Logo } from "@/components/logo";

export default function ThankYouPage() {
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
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We appreciate you taking the time to share your style preferences.
            Your input will help us create a design that matches your vision.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
