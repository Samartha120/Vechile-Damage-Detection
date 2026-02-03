import { Button } from "./ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import heroCar from "@/assets/hero-car.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 gradient-mesh" />
      
      {/* Animated glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-warning/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left space-y-6">
            <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm animate-fade-in">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Powered by Deep Learning CNN</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight animate-fade-in" style={{ animationDelay: '0.1s' }}>
              AI-Powered
              <span className="text-gradient block">Vehicle Damage</span>
              Detection
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Instantly detect and analyze vehicle damage with our advanced CNN technology. 
              Get accurate assessments in seconds, not hours.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Button variant="hero" size="xl">
                Start Detection
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="glass" size="xl">
                Watch Demo
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              <div>
                <div className="text-3xl font-bold text-primary">98%</div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">&lt;3s</div>
                <div className="text-sm text-muted-foreground">Analysis Time</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">50K+</div>
                <div className="text-sm text-muted-foreground">Scans Done</div>
              </div>
            </div>
          </div>
          
          {/* Right Content - Hero Image */}
          <div className="relative animate-slide-in-right">
            <div className="relative rounded-3xl overflow-hidden glow-primary">
              <img 
                src={heroCar} 
                alt="AI scanning vehicle for damage detection"
                className="w-full h-auto object-cover"
              />
              {/* Scan overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/10 pointer-events-none" />
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
              </div>
            </div>
            
            {/* Floating damage indicator */}
            <div className="absolute -right-4 top-1/4 glass rounded-xl p-4 animate-float">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning glow-warning" />
                <div>
                  <div className="text-sm font-medium">Damage Detected</div>
                  <div className="text-xs text-muted-foreground">Front bumper - Minor</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
