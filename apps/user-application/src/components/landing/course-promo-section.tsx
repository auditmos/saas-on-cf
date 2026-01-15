import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

export function CoursePromoSection() {
  return (
    <section className="w-full py-16 bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/1-dXh8J08UI?si=aSyQCYk1YVJAlG7X"
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-12 text-center">
          <Badge className="mb-4" variant="secondary">
            9 Modules • 11 Hours • 58 Video Lessons
          </Badge>

          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Full-Stack SaaS Development on Cloudflare Workers
          </h2>

          <p className="text-lg text-muted-foreground mb-8">
            Build blazing-fast, globally distributed applications with sub-50ms
            response times. Master the Cloudflare ecosystem through
            project-based learning.
          </p>

          <div className="grid md:grid-cols-2 gap-6 mb-8 text-left">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-2">What You'll Build</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    SmartLinks - Complete short link service
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Location-based intelligent redirects
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">AI-powered link analysis</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">Real-time analytics dashboard</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-lg mb-2">
                Technologies Covered
              </h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Cloudflare D1, KV, R2, Workers AI
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Durable Objects for state management
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">
                    Better Auth & Stripe integration
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                  <span className="text-sm">TypeScript, Drizzle ORM, pnpm</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild>
              <a
                href="https://learn.backpine.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Start Learning Now
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
