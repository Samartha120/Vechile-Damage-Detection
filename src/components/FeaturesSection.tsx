import { GlassCard } from "./GlassCard";
import { Brain, Zap, Shield, BarChart3, Camera, Clock } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "CNN Deep Learning",
    description: "Advanced Convolutional Neural Networks trained on millions of vehicle damage images for unparalleled accuracy."
  },
  {
    icon: Zap,
    title: "Instant Results",
    description: "Get comprehensive damage analysis in under 3 seconds. No waiting, no delays."
  },
  {
    icon: Shield,
    title: "Reliable Detection",
    description: "98% accuracy rate with continuous model improvements and validation against industry standards."
  },
  {
    icon: BarChart3,
    title: "Detailed Reports",
    description: "Receive comprehensive reports with damage severity, location mapping, and repair cost estimates."
  },
  {
    icon: Camera,
    title: "Multi-Angle Analysis",
    description: "Upload images from any angle. Our AI analyzes all perspectives to provide complete assessment."
  },
  {
    icon: Clock,
    title: "24/7 Availability",
    description: "Cloud-based processing ensures your damage detection is always available when you need it."
  }
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 gradient-mesh opacity-50" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Powered by <span className="text-gradient">Advanced AI</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our cutting-edge CNN technology delivers precise damage detection with features designed for efficiency and accuracy.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <GlassCard 
              key={feature.title} 
              className="animate-fade-in"
              hover
            >
              <div className="mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
