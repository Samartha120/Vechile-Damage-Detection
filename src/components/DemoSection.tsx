import { useState, useCallback, useRef } from "react";
import { GlassCard } from "./GlassCard";
import { Button } from "./ui/button";
import { Upload, Image, AlertTriangle, CheckCircle, X, DollarSign, Wrench, Download, Video, Play, Layers, Images } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import { Progress } from "./ui/progress";

interface DamageItem {
  type: string;
  location: string;
  severity: "Minor" | "Moderate" | "Severe";
  description: string;
}

interface AnalysisResult {
  hasVehicle: boolean;
  hasDamage: boolean;
  overallSeverity: "None" | "Minor" | "Moderate" | "Severe";
  confidenceScore: number;
  damages: DamageItem[];
  affectedAreas: string[];
  estimatedRepairCost: {
    min: number;
    max: number;
    currency: string;
  };
  recommendations: string[];
  summary: string;
  annotatedImage?: string | null;
}

interface FrameAnalysisResult extends AnalysisResult {
  frameIndex: number;
  frameImage: string;
}

interface CombinedAnalysisResult {
  totalFramesAnalyzed: number;
  framesWithDamage: number;
  overallSeverity: "None" | "Minor" | "Moderate" | "Severe";
  averageConfidence: number;
  allDamages: (DamageItem & { frameIndex: number })[];
  uniqueDamageTypes: string[];
  affectedAreas: string[];
  estimatedRepairCost: {
    min: number;
    max: number;
    currency: string;
  };
  recommendations: string[];
  summary: string;
  frameResults: FrameAnalysisResult[];
}

const DemoSection = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number>(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingAllFrames, setIsAnalyzingAllFrames] = useState(false);
  const [isAnalyzingAllImages, setIsAnalyzingAllImages] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalyzingFrame, setCurrentAnalyzingFrame] = useState(0);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [combinedResults, setCombinedResults] = useState<CombinedAnalysisResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'multi-image' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    
    if (files.length === 1) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      } else if (file.type.startsWith("video/")) {
        processVideoFile(file);
      }
    } else if (files.length > 1) {
      const imageFiles = files.filter(f => f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        processMultipleImages(imageFiles);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 1) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      } else if (file.type.startsWith("video/")) {
        processVideoFile(file);
      }
    } else if (files.length > 1) {
      const imageFiles = files.filter(f => f.type.startsWith("image/"));
      if (imageFiles.length > 0) {
        processMultipleImages(imageFiles);
      }
    }
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setUploadedImages([]);
      setUploadedVideo(null);
      setVideoFrames([]);
      setMediaType('image');
      setResults(null);
      setCombinedResults(null);
    };
    reader.readAsDataURL(file);
  };

  const processMultipleImages = async (files: File[]) => {
    const images: string[] = [];
    
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      images.push(dataUrl);
    }
    
    setUploadedImages(images);
    setUploadedImage(images[0]);
    setSelectedImageIndex(0);
    setUploadedVideo(null);
    setVideoFrames([]);
    setMediaType('multi-image');
    setResults(null);
    setCombinedResults(null);
    
    toast({
      title: "Images Uploaded",
      description: `${images.length} images ready for analysis. Select an image or analyze all at once.`,
    });
  };

  const processVideoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedVideo(reader.result as string);
      setUploadedImage(null);
      setUploadedImages([]);
      setVideoFrames([]);
      setMediaType('video');
      setResults(null);
      setCombinedResults(null);
    };
    reader.readAsDataURL(file);
  };

  const extractFramesFromVideo = async () => {
    if (!uploadedVideo || !videoRef.current) return;

    setIsExtractingFrames(true);
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      toast({
        title: "Error",
        description: "Could not create canvas context for frame extraction.",
        variant: "destructive",
      });
      setIsExtractingFrames(false);
      return;
    }

    const frames: string[] = [];
    const duration = video.duration;
    const frameCount = Math.min(6, Math.ceil(duration)); // Extract up to 6 frames
    const interval = duration / frameCount;

    try {
      for (let i = 0; i < frameCount; i++) {
        const time = i * interval + interval / 2;
        await new Promise<void>((resolve) => {
          video.currentTime = time;
          video.onseeked = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            frames.push(canvas.toDataURL('image/jpeg', 0.9));
            resolve();
          };
        });
      }

      setVideoFrames(frames);
      setSelectedFrameIndex(0);
      setUploadedImage(frames[0]);
      
      toast({
        title: "Frames Extracted",
        description: `Extracted ${frames.length} frames from video. Select a frame to analyze.`,
      });
    } catch (error) {
      console.error('Frame extraction error:', error);
      toast({
        title: "Extraction Failed",
        description: "Could not extract frames from video. Please try a different video.",
        variant: "destructive",
      });
    } finally {
      setIsExtractingFrames(false);
    }
  };

  const selectFrame = (index: number) => {
    setSelectedFrameIndex(index);
    setUploadedImage(videoFrames[index]);
    setResults(null);
    setCombinedResults(null);
  };

  const selectImage = (index: number) => {
    setSelectedImageIndex(index);
    setUploadedImage(uploadedImages[index]);
    setResults(null);
    setCombinedResults(null);
  };

  const analyzeAllImages = async () => {
    if (uploadedImages.length === 0) return;
    
    setIsAnalyzingAllImages(true);
    setAnalysisProgress(0);
    setCurrentAnalyzingFrame(0);
    setCombinedResults(null);
    setResults(null);
    
    const imageResults: FrameAnalysisResult[] = [];
    
    try {
      for (let i = 0; i < uploadedImages.length; i++) {
        setCurrentAnalyzingFrame(i + 1);
        
        const { data, error } = await supabase.functions.invoke('analyze-damage', {
          body: { imageBase64: uploadedImages[i] }
        });

        if (error) {
          console.error(`Error analyzing image ${i + 1}:`, error);
          continue;
        }

        if (data && !data.error) {
          imageResults.push({
            ...data,
            frameIndex: i,
            frameImage: uploadedImages[i]
          });
        }
        
        setAnalysisProgress(((i + 1) / uploadedImages.length) * 100);
      }

      if (imageResults.length === 0) {
        toast({
          title: "Analysis Failed",
          description: "Could not analyze any images. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Combine results from all images
      const combined = combineImageResults(imageResults);
      setCombinedResults(combined);
      
      toast({
        title: "Comprehensive Analysis Complete",
        description: `Analyzed ${imageResults.length} images. Found ${combined.allDamages.length} total damage instances.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze images. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingAllImages(false);
      setAnalysisProgress(0);
      setCurrentAnalyzingFrame(0);
    }
  };

  const combineImageResults = (imageResults: FrameAnalysisResult[]): CombinedAnalysisResult => {
    const imagesWithDamage = imageResults.filter(f => f.hasDamage).length;
    const avgConfidence = Math.round(
      imageResults.reduce((sum, f) => sum + f.confidenceScore, 0) / imageResults.length
    );
    
    // Collect all damages with image index
    const allDamages: (DamageItem & { frameIndex: number })[] = [];
    imageResults.forEach(image => {
      image.damages.forEach(damage => {
        allDamages.push({
          ...damage,
          frameIndex: image.frameIndex
        });
      });
    });

    // Get unique damage types
    const uniqueDamageTypes = [...new Set(allDamages.map(d => d.type))];
    
    // Get all affected areas
    const affectedAreas = [...new Set(imageResults.flatMap(f => f.affectedAreas))];
    
    // Determine overall severity (highest found)
    const severityOrder = { "None": 0, "Minor": 1, "Moderate": 2, "Severe": 3 };
    const overallSeverity = imageResults.reduce<"None" | "Minor" | "Moderate" | "Severe">((max, image) => {
      return severityOrder[image.overallSeverity] > severityOrder[max] ? image.overallSeverity : max;
    }, "None");

    // Calculate combined repair cost (take max range found)
    const minCost = Math.max(...imageResults.map(f => f.estimatedRepairCost?.min || 0));
    const maxCost = Math.max(...imageResults.map(f => f.estimatedRepairCost?.max || 0));
    const currency = imageResults.find(f => f.estimatedRepairCost?.currency)?.estimatedRepairCost?.currency || "INR";

    // Combine unique recommendations
    const recommendations = [...new Set(imageResults.flatMap(f => f.recommendations || []))];

    // Generate comprehensive summary
    const summary = `Comprehensive analysis of ${imageResults.length} images reveals ${imagesWithDamage} image(s) showing vehicle damage. ` +
      `A total of ${allDamages.length} damage instances were detected across ${uniqueDamageTypes.length} damage type(s): ${uniqueDamageTypes.join(", ")}. ` +
      `Affected areas include: ${affectedAreas.join(", ")}. Overall severity is assessed as ${overallSeverity}.`;

    return {
      totalFramesAnalyzed: imageResults.length,
      framesWithDamage: imagesWithDamage,
      overallSeverity,
      averageConfidence: avgConfidence,
      allDamages,
      uniqueDamageTypes,
      affectedAreas,
      estimatedRepairCost: {
        min: minCost,
        max: maxCost,
        currency
      },
      recommendations,
      summary,
      frameResults: imageResults
    };
  };

  const analyzeAllFrames = async () => {
    if (videoFrames.length === 0) return;
    
    setIsAnalyzingAllFrames(true);
    setAnalysisProgress(0);
    setCurrentAnalyzingFrame(0);
    setCombinedResults(null);
    setResults(null);
    
    const frameResults: FrameAnalysisResult[] = [];
    
    try {
      for (let i = 0; i < videoFrames.length; i++) {
        setCurrentAnalyzingFrame(i + 1);
        
        const { data, error } = await supabase.functions.invoke('analyze-damage', {
          body: { imageBase64: videoFrames[i] }
        });

        if (error) {
          console.error(`Error analyzing frame ${i + 1}:`, error);
          continue;
        }

        if (data && !data.error) {
          frameResults.push({
            ...data,
            frameIndex: i,
            frameImage: videoFrames[i]
          });
        }
        
        setAnalysisProgress(((i + 1) / videoFrames.length) * 100);
      }

      if (frameResults.length === 0) {
        toast({
          title: "Analysis Failed",
          description: "Could not analyze any frames. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Combine results from all frames
      const combined = combineFrameResults(frameResults);
      setCombinedResults(combined);
      
      toast({
        title: "Comprehensive Analysis Complete",
        description: `Analyzed ${frameResults.length} frames. Found ${combined.allDamages.length} total damage instances.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze frames. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingAllFrames(false);
      setAnalysisProgress(0);
      setCurrentAnalyzingFrame(0);
    }
  };

  const combineFrameResults = (frameResults: FrameAnalysisResult[]): CombinedAnalysisResult => {
    const framesWithDamage = frameResults.filter(f => f.hasDamage).length;
    const avgConfidence = Math.round(
      frameResults.reduce((sum, f) => sum + f.confidenceScore, 0) / frameResults.length
    );
    
    // Collect all damages with frame index
    const allDamages: (DamageItem & { frameIndex: number })[] = [];
    frameResults.forEach(frame => {
      frame.damages.forEach(damage => {
        allDamages.push({
          ...damage,
          frameIndex: frame.frameIndex
        });
      });
    });

    // Get unique damage types
    const uniqueDamageTypes = [...new Set(allDamages.map(d => d.type))];
    
    // Get all affected areas
    const affectedAreas = [...new Set(frameResults.flatMap(f => f.affectedAreas))];
    
    // Determine overall severity (highest found)
    const severityOrder = { "None": 0, "Minor": 1, "Moderate": 2, "Severe": 3 };
    const overallSeverity = frameResults.reduce<"None" | "Minor" | "Moderate" | "Severe">((max, frame) => {
      return severityOrder[frame.overallSeverity] > severityOrder[max] ? frame.overallSeverity : max;
    }, "None");

    // Calculate combined repair cost (take max range found)
    const minCost = Math.max(...frameResults.map(f => f.estimatedRepairCost?.min || 0));
    const maxCost = Math.max(...frameResults.map(f => f.estimatedRepairCost?.max || 0));
    const currency = frameResults.find(f => f.estimatedRepairCost?.currency)?.estimatedRepairCost?.currency || "INR";

    // Combine unique recommendations
    const recommendations = [...new Set(frameResults.flatMap(f => f.recommendations || []))];

    // Generate comprehensive summary
    const summary = `Comprehensive analysis of ${frameResults.length} video frames reveals ${framesWithDamage} frame(s) showing vehicle damage. ` +
      `A total of ${allDamages.length} damage instances were detected across ${uniqueDamageTypes.length} damage type(s): ${uniqueDamageTypes.join(", ")}. ` +
      `Affected areas include: ${affectedAreas.join(", ")}. Overall severity is assessed as ${overallSeverity}.`;

    return {
      totalFramesAnalyzed: frameResults.length,
      framesWithDamage,
      overallSeverity,
      averageConfidence: avgConfidence,
      allDamages,
      uniqueDamageTypes,
      affectedAreas,
      estimatedRepairCost: {
        min: minCost,
        max: maxCost,
        currency
      },
      recommendations,
      summary,
      frameResults
    };
  };

  const analyzeImage = async () => {
    if (!uploadedImage) return;
    
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-damage', {
        body: { imageBase64: uploadedImage }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResults(data);
      toast({
        title: "Analysis Complete",
        description: data.hasDamage 
          ? `Detected ${data.damages.length} damage(s) with ${data.overallSeverity} severity.`
          : "No damage detected on this vehicle.",
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearMedia = () => {
    setUploadedImage(null);
    setUploadedImages([]);
    setUploadedVideo(null);
    setVideoFrames([]);
    setMediaType(null);
    setResults(null);
    setCombinedResults(null);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "minor": return "text-success";
      case "moderate": return "text-warning";
      case "severe": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "minor": return "bg-success/20";
      case "moderate": return "bg-warning/20";
      case "severe": return "bg-destructive/20";
      default: return "bg-muted";
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const downloadPDF = async () => {
    if (!results || !uploadedImage) return;

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we create your damage report...",
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Header
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Vehicle Damage Analysis Report', margin, 22);
      
      // Date
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin - 60, 22);
      
      yPosition = 45;
      pdf.setTextColor(0, 0, 0);

      // Vehicle Image (annotated if available)
      const imageToUse = results.annotatedImage || uploadedImage;
      try {
        const imgData = imageToUse;
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = 70;
        pdf.addImage(imgData, 'JPEG', margin, yPosition, imgWidth, imgHeight, undefined, 'MEDIUM');
        yPosition += imgHeight + 10;
      } catch (imgError) {
        console.error('Error adding image to PDF:', imgError);
        yPosition += 10;
      }

      // Summary Section
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, pageWidth - (margin * 2), 25, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary', margin + 5, yPosition + 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      
      const summaryLines = pdf.splitTextToSize(results.summary, pageWidth - (margin * 2) - 10);
      pdf.text(summaryLines, margin + 5, yPosition + 16);
      yPosition += 30;

      // Stats Row
      const boxWidth = (pageWidth - (margin * 2) - 10) / 3;
      
      // Damages Found
      pdf.setFillColor(254, 243, 199);
      pdf.rect(margin, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(146, 64, 14);
      pdf.text('Damages Found', margin + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(results.damages.length), margin + boxWidth/2, yPosition + 15, { align: 'center' });

      // Confidence
      pdf.setFillColor(219, 234, 254);
      pdf.rect(margin + boxWidth + 5, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(30, 64, 175);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Confidence', margin + boxWidth + 5 + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${results.confidenceScore}%`, margin + boxWidth + 5 + boxWidth/2, yPosition + 15, { align: 'center' });

      // Severity
      const severityColor = results.overallSeverity === 'Severe' ? [254, 202, 202] : 
                           results.overallSeverity === 'Moderate' ? [254, 243, 199] : [209, 250, 229];
      const severityTextColor = results.overallSeverity === 'Severe' ? [153, 27, 27] : 
                                results.overallSeverity === 'Moderate' ? [146, 64, 14] : [22, 101, 52];
      pdf.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      pdf.rect(margin + (boxWidth * 2) + 10, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(severityTextColor[0], severityTextColor[1], severityTextColor[2]);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Overall Severity', margin + (boxWidth * 2) + 10 + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(results.overallSeverity, margin + (boxWidth * 2) + 10 + boxWidth/2, yPosition + 15, { align: 'center' });

      yPosition += 28;
      pdf.setTextColor(0, 0, 0);

      // Estimated Repair Cost
      if (results.estimatedRepairCost && results.estimatedRepairCost.max > 0) {
        pdf.setFillColor(220, 252, 231);
        pdf.rect(margin, yPosition, pageWidth - (margin * 2), 15, 'F');
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(22, 101, 52);
        const costText = `Estimated Repair Cost: ${formatCurrency(results.estimatedRepairCost.min, results.estimatedRepairCost.currency)} - ${formatCurrency(results.estimatedRepairCost.max, results.estimatedRepairCost.currency)}`;
        pdf.text(costText, pageWidth / 2, yPosition + 10, { align: 'center' });
        yPosition += 22;
      }

      pdf.setTextColor(0, 0, 0);

      // Damage Details
      if (results.damages.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Damage Details', margin, yPosition);
        yPosition += 8;

        results.damages.forEach((damage, index) => {
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }

          const damageBoxColor = damage.severity === 'Severe' ? [254, 226, 226] : 
                                 damage.severity === 'Moderate' ? [254, 249, 195] : [220, 252, 231];
          pdf.setFillColor(damageBoxColor[0], damageBoxColor[1], damageBoxColor[2]);
          pdf.rect(margin, yPosition, pageWidth - (margin * 2), 22, 'F');
          
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${index + 1}. ${damage.type}`, margin + 5, yPosition + 7);
          
          const severityBadge = damage.severity;
          pdf.setFontSize(8);
          pdf.text(`[${severityBadge}]`, pageWidth - margin - 20, yPosition + 7);
          
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          pdf.text(`Location: ${damage.location}`, margin + 5, yPosition + 14);
          
          const descLines = pdf.splitTextToSize(damage.description, pageWidth - (margin * 2) - 10);
          pdf.text(descLines[0] || '', margin + 5, yPosition + 20);
          
          yPosition += 26;
        });
      }

      // Recommendations
      if (results.recommendations && results.recommendations.length > 0) {
        if (yPosition > pageHeight - 50) {
          pdf.addPage();
          yPosition = margin;
        }

        yPosition += 5;
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Recommendations', margin, yPosition);
        yPosition += 8;

        results.recommendations.forEach((rec, index) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          const recLines = pdf.splitTextToSize(`• ${rec}`, pageWidth - (margin * 2));
          pdf.text(recLines, margin + 5, yPosition);
          yPosition += recLines.length * 5 + 3;
        });
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by DamageDetect AI - Vehicle Damage Analysis System', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save PDF
      pdf.save(`damage-report-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: "Your damage report has been saved successfully.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const downloadCombinedPDF = async () => {
    if (!combinedResults) return;

    try {
      toast({
        title: "Generating PDF",
        description: "Please wait while we create your comprehensive damage report...",
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Header
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pageWidth, 35, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Comprehensive Video Damage Analysis', margin, 18);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${combinedResults.totalFramesAnalyzed} Frames Analyzed`, margin, 28);
      pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin - 60, 28);
      
      yPosition = 45;
      pdf.setTextColor(0, 0, 0);

      // Summary Section
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, yPosition, pageWidth - (margin * 2), 35, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Summary', margin + 5, yPosition + 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      const summaryLines = pdf.splitTextToSize(combinedResults.summary, pageWidth - (margin * 2) - 10);
      pdf.text(summaryLines, margin + 5, yPosition + 16);
      yPosition += 42;

      // Stats Row
      const boxWidth = (pageWidth - (margin * 2) - 15) / 4;
      
      // Frames Analyzed
      pdf.setFillColor(219, 234, 254);
      pdf.rect(margin, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(30, 64, 175);
      pdf.text('Frames Analyzed', margin + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(combinedResults.totalFramesAnalyzed), margin + boxWidth/2, yPosition + 15, { align: 'center' });

      // Frames with Damage
      pdf.setFillColor(254, 243, 199);
      pdf.rect(margin + boxWidth + 5, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(146, 64, 14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Frames w/ Damage', margin + boxWidth + 5 + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(combinedResults.framesWithDamage), margin + boxWidth + 5 + boxWidth/2, yPosition + 15, { align: 'center' });

      // Total Damages
      pdf.setFillColor(254, 226, 226);
      pdf.rect(margin + (boxWidth * 2) + 10, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(153, 27, 27);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Total Damages', margin + (boxWidth * 2) + 10 + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(combinedResults.allDamages.length), margin + (boxWidth * 2) + 10 + boxWidth/2, yPosition + 15, { align: 'center' });

      // Avg Confidence
      pdf.setFillColor(220, 252, 231);
      pdf.rect(margin + (boxWidth * 3) + 15, yPosition, boxWidth, 20, 'F');
      pdf.setFontSize(7);
      pdf.setTextColor(22, 101, 52);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Avg Confidence', margin + (boxWidth * 3) + 15 + boxWidth/2, yPosition + 6, { align: 'center' });
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${combinedResults.averageConfidence}%`, margin + (boxWidth * 3) + 15 + boxWidth/2, yPosition + 15, { align: 'center' });

      yPosition += 28;
      pdf.setTextColor(0, 0, 0);

      // Overall Severity & Repair Cost
      const severityColor = combinedResults.overallSeverity === 'Severe' ? [254, 202, 202] : 
                           combinedResults.overallSeverity === 'Moderate' ? [254, 243, 199] : [209, 250, 229];
      pdf.setFillColor(severityColor[0], severityColor[1], severityColor[2]);
      pdf.rect(margin, yPosition, (pageWidth - (margin * 2)) / 2 - 3, 18, 'F');
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Overall Severity:', margin + 5, yPosition + 7);
      pdf.setFont('helvetica', 'bold');
      pdf.text(combinedResults.overallSeverity, margin + 5, yPosition + 14);

      if (combinedResults.estimatedRepairCost && combinedResults.estimatedRepairCost.max > 0) {
        pdf.setFillColor(220, 252, 231);
        pdf.rect(margin + (pageWidth - (margin * 2)) / 2 + 3, yPosition, (pageWidth - (margin * 2)) / 2 - 3, 18, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(22, 101, 52);
        pdf.text('Estimated Repair Cost:', margin + (pageWidth - (margin * 2)) / 2 + 8, yPosition + 7);
        pdf.setFont('helvetica', 'bold');
        const costText = `${formatCurrency(combinedResults.estimatedRepairCost.min, combinedResults.estimatedRepairCost.currency)} - ${formatCurrency(combinedResults.estimatedRepairCost.max, combinedResults.estimatedRepairCost.currency)}`;
        pdf.text(costText, margin + (pageWidth - (margin * 2)) / 2 + 8, yPosition + 14);
      }

      yPosition += 25;
      pdf.setTextColor(0, 0, 0);

      // Unique Damage Types
      if (combinedResults.uniqueDamageTypes.length > 0) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Damage Types Detected', margin, yPosition);
        yPosition += 6;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(combinedResults.uniqueDamageTypes.join(', '), margin + 5, yPosition);
        yPosition += 8;
      }

      // Affected Areas
      if (combinedResults.affectedAreas.length > 0) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Affected Areas', margin, yPosition);
        yPosition += 6;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(combinedResults.affectedAreas.join(', '), margin + 5, yPosition);
        yPosition += 12;
      }

      // All Damage Details
      if (combinedResults.allDamages.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('All Damage Instances', margin, yPosition);
        yPosition += 7;

        combinedResults.allDamages.forEach((damage, index) => {
          if (yPosition > pageHeight - 35) {
            pdf.addPage();
            yPosition = margin;
          }

          const damageBoxColor = damage.severity === 'Severe' ? [254, 226, 226] : 
                                 damage.severity === 'Moderate' ? [254, 249, 195] : [220, 252, 231];
          pdf.setFillColor(damageBoxColor[0], damageBoxColor[1], damageBoxColor[2]);
          pdf.rect(margin, yPosition, pageWidth - (margin * 2), 18, 'F');
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${index + 1}. ${damage.type} (Frame ${damage.frameIndex + 1})`, margin + 5, yPosition + 6);
          
          pdf.setFontSize(8);
          pdf.text(`[${damage.severity}]`, pageWidth - margin - 20, yPosition + 6);
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(80, 80, 80);
          pdf.text(`Location: ${damage.location}`, margin + 5, yPosition + 12);
          
          const descLines = pdf.splitTextToSize(damage.description, pageWidth - (margin * 2) - 10);
          pdf.text(descLines[0] || '', margin + 5, yPosition + 16);
          
          yPosition += 22;
        });
      }

      // Recommendations
      if (combinedResults.recommendations && combinedResults.recommendations.length > 0) {
        if (yPosition > pageHeight - 50) {
          pdf.addPage();
          yPosition = margin;
        }

        yPosition += 3;
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Recommendations', margin, yPosition);
        yPosition += 7;

        combinedResults.recommendations.forEach((rec) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = margin;
          }
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(60, 60, 60);
          const recLines = pdf.splitTextToSize(`• ${rec}`, pageWidth - (margin * 2));
          pdf.text(recLines, margin + 5, yPosition);
          yPosition += recLines.length * 4 + 3;
        });
      }

      // Frame-by-Frame Images (new page)
      pdf.addPage();
      yPosition = margin;
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('Frame-by-Frame Analysis', margin, yPosition);
      yPosition += 10;

      const framesPerRow = 2;
      const frameImgWidth = (pageWidth - (margin * 2) - 10) / framesPerRow;
      const frameImgHeight = 45;

      for (let i = 0; i < combinedResults.frameResults.length; i++) {
        const frame = combinedResults.frameResults[i];
        const col = i % framesPerRow;
        const xPos = margin + col * (frameImgWidth + 10);

        if (col === 0 && i > 0) {
          yPosition += frameImgHeight + 20;
        }

        if (yPosition + frameImgHeight > pageHeight - 20) {
          pdf.addPage();
          yPosition = margin;
        }

        try {
          const imgToUse = frame.annotatedImage || frame.frameImage;
          pdf.addImage(imgToUse, 'JPEG', xPos, yPosition, frameImgWidth, frameImgHeight, undefined, 'MEDIUM');
          
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`Frame ${frame.frameIndex + 1}`, xPos, yPosition + frameImgHeight + 5);
          pdf.setFont('helvetica', 'normal');
          const frameInfo = frame.hasDamage 
            ? `${frame.damages.length} damage(s) - ${frame.overallSeverity}` 
            : 'No damage';
          pdf.text(frameInfo, xPos, yPosition + frameImgHeight + 9);
        } catch (imgError) {
          console.error('Error adding frame image:', imgError);
        }
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text('Generated by DamageDetect AI - Comprehensive Video Analysis', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // Save PDF
      pdf.save(`comprehensive-damage-report-${new Date().toISOString().split('T')[0]}.pdf`);

      toast({
        title: "PDF Downloaded",
        description: "Your comprehensive damage report has been saved successfully.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "PDF Generation Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <section id="demo" className="py-24 relative">
      <div className="absolute inset-0 gradient-mesh opacity-30" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Try the <span className="text-gradient">Demo</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Upload vehicle images or videos to see our AI damage detection in action. You can upload multiple images at once for comprehensive analysis.
          </p>
        </div>
        
        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Upload Area */}
          <GlassCard className="p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Image or Video
            </h3>
            
            {!uploadedImage && !uploadedVideo ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                  isDragOver 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-center gap-4 mb-4">
                  <Image className="w-10 h-10 text-muted-foreground" />
                  <Images className="w-10 h-10 text-muted-foreground" />
                  <Video className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-2">
                  Drag & drop images or video here, or click to browse
                </p>
                <p className="text-muted-foreground/70 text-sm mb-4">
                  Upload multiple images for comprehensive multi-angle analysis
                </p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  multiple
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" className="cursor-pointer" asChild>
                    <span>Choose Files</span>
                  </Button>
                </label>
              </div>
            ) : mediaType === 'video' && !videoFrames.length ? (
              <div className="relative">
                <button
                  onClick={clearMedia}
                  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <video
                  ref={videoRef}
                  src={uploadedVideo!}
                  className="w-full rounded-xl object-cover max-h-64"
                  controls
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                    }
                  }}
                />
                
                <div className="mt-4">
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full gap-2"
                    onClick={extractFramesFromVideo}
                    disabled={isExtractingFrames}
                  >
                    {isExtractingFrames ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Extracting Frames...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Extract Frames for Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : mediaType === 'video' && videoFrames.length > 0 ? (
              <div className="relative">
                <button
                  onClick={clearMedia}
                  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Selected Frame Display */}
                {results?.annotatedImage ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Damage areas highlighted</span>
                    </div>
                    <img
                      src={results.annotatedImage}
                      alt="Annotated vehicle with damage markers"
                      className="w-full rounded-xl object-cover max-h-64 border-2 border-primary/50"
                    />
                  </div>
                ) : (
                  <img
                    src={videoFrames[selectedFrameIndex]}
                    alt={`Video frame ${selectedFrameIndex + 1}`}
                    className="w-full rounded-xl object-cover max-h-48"
                  />
                )}
                
                {/* Frame Thumbnails */}
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Select a frame to analyze:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {videoFrames.map((frame, index) => (
                      <button
                        key={index}
                        onClick={() => selectFrame(index)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          selectedFrameIndex === index 
                            ? 'border-primary ring-2 ring-primary/30' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={frame}
                          alt={`Frame ${index + 1}`}
                          className="w-full h-16 object-cover"
                        />
                        <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-xs py-0.5 text-center">
                          Frame {index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Analysis Progress */}
                {isAnalyzingAllFrames && (
                  <div className="mt-4 p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Analyzing frame {currentAnalyzingFrame} of {videoFrames.length}...
                      </span>
                      <span className="text-sm font-medium text-primary">{Math.round(analysisProgress)}%</span>
                    </div>
                    <Progress value={analysisProgress} className="h-2" />
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {/* Analyze All Frames Button */}
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full gap-2"
                    onClick={analyzeAllFrames}
                    disabled={isAnalyzingAllFrames || isAnalyzing}
                  >
                    {isAnalyzingAllFrames ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Analyzing All Frames...
                      </>
                    ) : combinedResults ? (
                      <>
                        <Layers className="w-5 h-5" />
                        Re-Analyze All Frames
                      </>
                    ) : (
                      <>
                        <Layers className="w-5 h-5" />
                        Analyze All Frames
                      </>
                    )}
                  </Button>

                  {/* Analyze Single Frame Button */}
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={analyzeImage}
                    disabled={isAnalyzing || isAnalyzingAllFrames}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                        Analyzing Frame...
                      </>
                    ) : results ? (
                      "Re-Analyze Selected Frame"
                    ) : (
                      "Analyze Selected Frame Only"
                    )}
                  </Button>
                </div>
              </div>
            ) : mediaType === 'multi-image' && uploadedImages.length > 0 ? (
              <div className="relative">
                <button
                  onClick={clearMedia}
                  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Selected Image Display */}
                {results?.annotatedImage ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Damage areas highlighted</span>
                    </div>
                    <img
                      src={results.annotatedImage}
                      alt="Annotated vehicle with damage markers"
                      className="w-full rounded-xl object-cover max-h-64 border-2 border-primary/50"
                    />
                  </div>
                ) : (
                  <img
                    src={uploadedImages[selectedImageIndex]}
                    alt={`Uploaded image ${selectedImageIndex + 1}`}
                    className="w-full rounded-xl object-cover max-h-48"
                  />
                )}
                
                {/* Image Thumbnails */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">
                      {uploadedImages.length} images uploaded - select to preview:
                    </p>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      <Images className="w-3 h-3 inline mr-1" />
                      Multi-Image
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {uploadedImages.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => selectImage(index)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === index 
                            ? 'border-primary ring-2 ring-primary/30' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`Image ${index + 1}`}
                          className="w-full h-14 object-cover"
                        />
                        <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-xs py-0.5 text-center">
                          {index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Analysis Progress */}
                {isAnalyzingAllImages && (
                  <div className="mt-4 p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Analyzing image {currentAnalyzingFrame} of {uploadedImages.length}...
                      </span>
                      <span className="text-sm font-medium text-primary">{Math.round(analysisProgress)}%</span>
                    </div>
                    <Progress value={analysisProgress} className="h-2" />
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {/* Analyze All Images Button */}
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full gap-2"
                    onClick={analyzeAllImages}
                    disabled={isAnalyzingAllImages || isAnalyzing}
                  >
                    {isAnalyzingAllImages ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Analyzing All Images...
                      </>
                    ) : combinedResults ? (
                      <>
                        <Images className="w-5 h-5" />
                        Re-Analyze All Images
                      </>
                    ) : (
                      <>
                        <Images className="w-5 h-5" />
                        Analyze All {uploadedImages.length} Images
                      </>
                    )}
                  </Button>

                  {/* Analyze Single Image Button */}
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={analyzeImage}
                    disabled={isAnalyzing || isAnalyzingAllImages}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                        Analyzing Image...
                      </>
                    ) : results ? (
                      "Re-Analyze Selected Image"
                    ) : (
                      "Analyze Selected Image Only"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <button
                  onClick={clearMedia}
                  className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                
                {/* Show annotated image if available, otherwise original */}
                {results?.annotatedImage ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Damage areas highlighted</span>
                    </div>
                    <img
                      src={results.annotatedImage}
                      alt="Annotated vehicle with damage markers"
                      className="w-full rounded-xl object-cover max-h-80 border-2 border-primary/50"
                    />
                  </div>
                ) : (
                  <img
                    src={uploadedImage!}
                    alt="Uploaded vehicle"
                    className="w-full rounded-xl object-cover max-h-64"
                  />
                )}
                
                <div className="mt-4">
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Analyzing with AI...
                      </>
                    ) : results ? (
                      "Re-Analyze"
                    ) : (
                      "Analyze Damage"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </GlassCard>
          
          {/* Results Area */}
          <GlassCard className="p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Detection Results
            </h3>
            
            {/* Combined Results View */}
            {combinedResults ? (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {/* Header Badge */}
                <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                  {mediaType === 'multi-image' ? (
                    <Images className="w-4 h-4 text-primary" />
                  ) : (
                    <Layers className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-sm font-medium text-primary">
                    Comprehensive {mediaType === 'multi-image' ? 'Multi-Image' : 'Multi-Frame'} Analysis
                  </span>
                </div>

                {/* Summary */}
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-sm text-foreground">{combinedResults.summary}</p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <span className="text-muted-foreground text-xs">
                      {mediaType === 'multi-image' ? 'Images Analyzed' : 'Frames Analyzed'}
                    </span>
                    <p className="text-xl font-bold text-primary">{combinedResults.totalFramesAnalyzed}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <span className="text-muted-foreground text-xs">
                      {mediaType === 'multi-image' ? 'Images w/ Damage' : 'Frames w/ Damage'}
                    </span>
                    <p className="text-xl font-bold text-warning">{combinedResults.framesWithDamage}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <span className="text-muted-foreground text-xs">Total Damages</span>
                    <p className="text-xl font-bold text-destructive">{combinedResults.allDamages.length}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/50 text-center">
                    <span className="text-muted-foreground text-xs">Avg Confidence</span>
                    <p className="text-xl font-bold text-success">{combinedResults.averageConfidence}%</p>
                  </div>
                </div>

                {/* Overall Severity */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">Overall Severity</span>
                  <span className={`px-4 py-1 rounded-full text-sm font-medium ${getSeverityBg(combinedResults.overallSeverity)} ${getSeverityColor(combinedResults.overallSeverity)}`}>
                    {combinedResults.overallSeverity}
                  </span>
                </div>

                {/* Estimated Cost */}
                {combinedResults.estimatedRepairCost && combinedResults.estimatedRepairCost.max > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground text-sm">Estimated Repair Cost</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(combinedResults.estimatedRepairCost.min, combinedResults.estimatedRepairCost.currency)} - {formatCurrency(combinedResults.estimatedRepairCost.max, combinedResults.estimatedRepairCost.currency)}
                    </p>
                  </div>
                )}

                {/* Damage Types Found */}
                {combinedResults.uniqueDamageTypes.length > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <span className="text-muted-foreground text-sm">Damage Types Detected</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {combinedResults.uniqueDamageTypes.map((type, index) => (
                        <span key={index} className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affected Areas */}
                {combinedResults.affectedAreas.length > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <span className="text-muted-foreground text-sm">Affected Areas</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {combinedResults.affectedAreas.map((area, index) => (
                        <span key={index} className="px-3 py-1 rounded-full text-xs font-medium bg-warning/20 text-warning">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Damage Details */}
                {combinedResults.allDamages.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">All Damage Instances</h4>
                    {combinedResults.allDamages.map((damage, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-secondary/50 animate-fade-in"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{damage.type}</span>
                            <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded">
                              {mediaType === 'multi-image' ? 'Image' : 'Frame'} {damage.frameIndex + 1}
                            </span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityBg(damage.severity)} ${getSeverityColor(damage.severity)}`}>
                            {damage.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{damage.location}</p>
                        <p className="text-xs text-muted-foreground/70">{damage.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {combinedResults.recommendations && combinedResults.recommendations.length > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Recommendations</span>
                    </div>
                    <ul className="space-y-2">
                      {combinedResults.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Download Combined PDF Button */}
                <Button
                  variant="outline"
                  className="w-full mt-4 gap-2"
                  onClick={downloadCombinedPDF}
                >
                  <Download className="w-4 h-4" />
                  Download Comprehensive Report as PDF
                </Button>
              </div>
            ) : !results ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  Upload images or video and click "Analyze" to see AI detection results
                </p>
              </div>
            ) : !results.hasVehicle ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-warning/20 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8 text-warning" />
                </div>
                <p className="text-muted-foreground">
                  No vehicle detected in the image. Please upload a clear image of a vehicle.
                </p>
              </div>
            ) : !results.hasDamage ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
                <h4 className="text-lg font-semibold text-success mb-2">No Damage Detected!</h4>
                <p className="text-muted-foreground text-sm mb-4">
                  {results.summary}
                </p>
                <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-xs text-success">
                    Confidence: {results.confidenceScore}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {/* Summary */}
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-sm text-foreground">{results.summary}</p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <span className="text-muted-foreground text-sm">Damages Found</span>
                    <p className="text-2xl font-bold text-warning">{results.damages.length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 text-center">
                    <span className="text-muted-foreground text-sm">Confidence</span>
                    <p className="text-2xl font-bold text-primary">{results.confidenceScore}%</p>
                  </div>
                </div>

                {/* Overall Severity */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50">
                  <span className="text-muted-foreground">Overall Severity</span>
                  <span className={`px-4 py-1 rounded-full text-sm font-medium ${getSeverityBg(results.overallSeverity)} ${getSeverityColor(results.overallSeverity)}`}>
                    {results.overallSeverity}
                  </span>
                </div>

                {/* Estimated Cost */}
                {results.estimatedRepairCost && results.estimatedRepairCost.max > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground text-sm">Estimated Repair Cost</span>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(results.estimatedRepairCost.min, results.estimatedRepairCost.currency)} - {formatCurrency(results.estimatedRepairCost.max, results.estimatedRepairCost.currency)}
                    </p>
                  </div>
                )}

                {/* Damage Details */}
                {results.damages.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Damage Details</h4>
                    {results.damages.map((damage, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-secondary/50 animate-fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{damage.type}</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityBg(damage.severity)} ${getSeverityColor(damage.severity)}`}>
                            {damage.severity}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">{damage.location}</p>
                        <p className="text-xs text-muted-foreground/70">{damage.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {results.recommendations && results.recommendations.length > 0 && (
                  <div className="p-4 rounded-xl bg-secondary/50">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Recommendations</span>
                    </div>
                    <ul className="space-y-2">
                      {results.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Download PDF Button */}
                <Button
                  variant="outline"
                  className="w-full mt-4 gap-2"
                  onClick={downloadPDF}
                >
                  <Download className="w-4 h-4" />
                  Download Report as PDF
                </Button>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
