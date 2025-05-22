import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

export const Login = () => {
  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-lg">Login</CardTitle>
        <CardDescription className="text-center text-sm text-muted-foreground">
          Login with your Discord account to access the app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Button className="flex items-center gap-2">
            <img className="h-5 w-5" src="/discord.svg" alt="discord icon" />
            <a href={`${import.meta.env.PUBLIC_API_URL}/auth/login`}>
              Continue with Discord
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
