import { createFileRoute } from "@tanstack/react-router";
import { NavigationBar } from "@/components/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { Footer } from "@/components/landing/footer";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavigationBar />
      <main>
        <HeroSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
}
