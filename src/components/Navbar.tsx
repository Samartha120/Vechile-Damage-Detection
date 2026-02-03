import { Car, Menu, X } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Car className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-gradient">AutoScan AI</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
              How It Works
            </a>
            <a href="#demo" className="text-muted-foreground hover:text-primary transition-colors">
              Demo
            </a>
            <Button variant="hero" size="sm" asChild>
              <a href="#demo">Get Started</a>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-foreground"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
                How It Works
              </a>
              <a href="#demo" className="text-muted-foreground hover:text-primary transition-colors">
                Demo
              </a>
              <Button variant="hero" size="sm" className="w-fit" asChild>
                <a href="#demo">Get Started</a>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
