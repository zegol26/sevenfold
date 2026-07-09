import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Unauthorized</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>
              Your account is not allowed to access this workflow. Backend permissions remain enforced by Apps Script.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </main>
  );
}
