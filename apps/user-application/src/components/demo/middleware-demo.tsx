import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  Play,
  Server,
  Zap,
  CheckCircle,
  AlertCircle,
  Code2,
} from "lucide-react";
import { examplefunction } from "@/core/functions/example-functions";

export function MiddlewareDemo() {
  const [inputValue, setInputValue] = React.useState("Hello TanStack Start!");

  const mutation = useMutation({
    mutationFn: examplefunction,
    onSuccess: (data) => {
      console.log("Client: Server function executed successfully:", data);
    },
    onError: (error) => {
      console.error("Client: Server function failed:", error);
    },
  });

  const handleExecute = () => {
    mutation.mutate({
      data: {
        exampleKey: "exampleValue",
      },
    });
  };

  return (
    <section className="py-24 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4">
            <Server className="w-4 h-4 mr-2" />
            Server Functions & Middleware
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            Server-Side Data Flow
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See TanStack Start's middleware and server functions in action with
            TanStack Query. Check your server logs to see the execution flow!
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Demo Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="w-5 h-5 mr-2 text-primary" />
                  Interactive Demo
                </CardTitle>
                <CardDescription>
                  Execute a server function with middleware through TanStack
                  Query
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label
                    htmlFor="input-value"
                    className="block text-sm font-medium mb-2"
                  >
                    Message to Send
                  </label>
                  <input
                    id="input-value"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
                    placeholder="Enter a message..."
                  />
                </div>

                <Button
                  onClick={handleExecute}
                  disabled={mutation.isPending || !inputValue.trim()}
                  className="w-full"
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Execute Server Function
                </Button>

                {/* Status Display */}
                <div className="space-y-2">
                  {mutation.isPending && (
                    <Alert>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <AlertDescription>
                        Executing server function with middleware...
                      </AlertDescription>
                    </Alert>
                  )}

                  {mutation.isSuccess && (
                    <Alert className="border-green-500 bg-green-200/10">
                      <CheckCircle className="w-4 h-4 text-green-800 dark:text-green-400" />
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        <strong>Success!</strong> Response: "{mutation.data}"
                      </AlertDescription>
                    </Alert>
                  )}

                  {mutation.isError && (
                    <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <AlertDescription className="text-red-800 dark:text-red-200">
                        <strong>Error:</strong>{" "}
                        {mutation.error?.message || "Something went wrong"}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Architecture Info */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code2 className="w-5 h-5 mr-2 text-primary" />
                  What's Happening
                </CardTitle>
                <CardDescription>
                  The execution flow and server-side processing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      Execution Flow
                    </h4>
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                          1
                        </span>
                        <span>
                          Client sends request via TanStack Query mutation
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                          2
                        </span>
                        <span>
                          Middleware executes first (adds context data)
                        </span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                          3
                        </span>
                        <span>Input validation with Zod schema</span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                          4
                        </span>
                        <span>Server function handler executes</span>
                      </li>
                      <li className="flex items-start">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                          5
                        </span>
                        <span>Response sent back to client</span>
                      </li>
                    </ol>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Alert>
                      <Server className="w-4 h-4" />
                      <AlertDescription>
                        <strong>Check your server logs!</strong> You'll see
                        console output from both the middleware and server
                        function execution.
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      <strong>Files involved:</strong>
                    </p>
                    <ul className="space-y-1 ml-4">
                      <li>
                        • <code>src/core/middleware/example-middleware.ts</code>
                      </li>
                      <li>
                        • <code>src/core/functions/example-functions.ts</code>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-6 bg-muted/50 rounded-xl">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-primary" />
              Key Benefits
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong className="text-foreground">Type-Safe</strong>
                <p className="text-muted-foreground">
                  Full TypeScript support with Zod validation
                </p>
              </div>
              <div>
                <strong className="text-foreground">Server-First</strong>
                <p className="text-muted-foreground">
                  Execute secure server-side logic seamlessly
                </p>
              </div>
              <div>
                <strong className="text-foreground">Middleware Ready</strong>
                <p className="text-muted-foreground">
                  Composable middleware for authentication, logging, etc.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
