import { createFileRoute } from "@tanstack/react-router";
import { NavigationBar } from "@/components/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { ClaudeCodeSection } from "@/components/landing/claude-code-section";
import { CoursePromoSection } from "@/components/landing/course-promo-section";
import { Footer } from "@/components/landing/footer";
import { MiddlewareDemo } from "@/components/demo";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main>
        <HeroSection />
        <ClaudeCodeSection />
        <FeaturesSection />
        <MiddlewareDemo />
        <CoursePromoSection />
      </main>
      <Footer />
    </div>
  );
}
