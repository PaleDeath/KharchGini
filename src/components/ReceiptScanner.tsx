"use client"

import React, { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, Camera, X, FileText, Image as ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface ReceiptScannerProps {
  onScanComplete?: (data: any) => void
}

export function ReceiptScanner({ onScanComplete }: ReceiptScannerProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { toast } = useToast()

  const validateFile = useCallback((file: File): boolean => {
    const validTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a JPG, PNG, or WEBP image.",
      })
      return false
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Image size must be less than 2MB.",
      })
      return false
    }

    return true
  }, [toast])

  const handleFile = useCallback((selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile)
      const objectUrl = URL.createObjectURL(selectedFile)
      setPreviewUrl(objectUrl)
      // Reset progress if re-selecting
      setProgress(0)
      setIsProcessing(false)
    }
  }, [validateFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0])
    }
    // Reset input value to allow re-selecting same file
    e.target.value = ""
  }

  const startProcessing = () => {
    if (!file) return

    setIsProcessing(true)
    setProgress(0)

    // Simulate OCR processing
    let currentProgress = 0
    processingIntervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 10
      if (currentProgress >= 100) {
        currentProgress = 100
        if (processingIntervalRef.current) {
          clearInterval(processingIntervalRef.current)
        }
        setIsProcessing(false)
        if (onScanComplete) {
          onScanComplete({ text: "Simulated extracted text", file })
        }
        toast({
          title: "Scan Complete",
          description: "Receipt processed successfully.",
        })
      }
      setProgress(Math.min(currentProgress, 100))
    }, 200)
  }

  const cancelProcessing = () => {
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current)
      processingIntervalRef.current = null
    }
    setIsProcessing(false)
    setProgress(0)
    toast({
      description: "Scanning cancelled.",
    })
  }

  const removeFile = () => {
    if (isProcessing) {
      cancelProcessing()
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setFile(null)
    setPreviewUrl(null)
    setProgress(0)
  }

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current)
      }
    }
  }, [previewUrl])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6 space-y-4">
        {!file ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-4",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="p-4 bg-muted rounded-full">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP (max 2MB)</p>
            </div>

            <div className="flex gap-2 w-full mt-2" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Select Image
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="w-4 h-4 mr-2" />
                Camera
              </Button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileInputChange}
            />
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileInputChange}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden border bg-muted/50 aspect-video flex items-center justify-center">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="w-full h-full object-contain"
                />
              )}
              {!isProcessing && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 bg-background/80 hover:bg-background/90 rounded-full"
                  onClick={removeFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3 p-3 border rounded-md bg-background">
              <div className="p-2 bg-primary/10 rounded-full">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            {isProcessing ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Extracting text...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onClick={cancelProcessing}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={startProcessing}>
                {progress === 100 ? "Scan Again" : "Scan Receipt"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
