import { GlassCard } from "./GlassCard";
import { Upload, Cpu, FileCheck, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: Upload,
    step: "01",
    title: "Upload Image",
    description: "Simply upload a photo of the vehicle from any angle. Supports multiple image formats."
  },
  {
    icon: Cpu,
    step: "02",
    title: "AI Analysis",
    description: "Our CNN model processes the image, detecting and classifying all visible damage."
  },
  {
    icon: FileCheck,
    step: "03",
    title: "Get Results",
    description: "Receive a detailed report with damage locations, severity levels, and repair recommendations."
  }
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to get accurate vehicle damage assessment powered by our advanced AI technology.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-primary/50 via-primary to-primary/50 -translate-y-1/2 z-0" />
          
          {steps.map((item, index) => (
            <div key={item.step} className="relative z-10">
              <GlassCard className="text-center relative overflow-visible">
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary rounded-full text-primary-foreground text-sm font-bold">
                  Step {item.step}
                </div>
                
                <div className="pt-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </GlassCard>
              
              {/* Arrow between cards */}
              {index < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-4 -translate-y-1/2 z-20">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
