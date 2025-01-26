import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Slider } from './Slider';
import { ImageState, Tool, Filter } from '../types';
import { Upload, Download, Crop, Sliders, Wand2, X, Undo, Redo, Link, ChevronLeft, ChevronRight } from 'lucide-react';

const filters: Filter[] = [
  { name: 'Normal', style: '' },
  { name: 'Warm', style: 'sepia(50%) hue-rotate(-30deg)' },
  { name: 'Cool', style: 'sepia(30%) hue-rotate(180deg)' },
  { name: 'Vintage', style: 'sepia(80%)' },
  { name: 'B&W', style: 'grayscale(100%)' },
  { name: 'Movie', style: 'contrast(110%) saturate(130%)' },
  { name: 'Dramatic', style: 'contrast(150%) saturate(90%)' },
  { name: 'Fade', style: 'opacity(90%) brightness(110%)' },
  { name: 'Matte', style: 'contrast(90%) brightness(110%) saturate(80%)' },
  { name: 'Vivid', style: 'saturate(200%) contrast(110%)' },
  { name: 'Chrome', style: 'contrast(120%) saturate(110%) hue-rotate(-10deg)' },
  { name: 'Noir', style: 'grayscale(100%) contrast(120%)' }
];

const initialState: ImageState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  feather: 0,
  filter: '',
  crop: null,
};

interface HistoryState {
  canvas: string;
  state: ImageState;
}

export function ImageEditor() {
  const [image, setImage] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('adjust');
  const [state, setState] = useState<ImageState>(initialState);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [filterPreviews, setFilterPreviews] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const filterContainerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const isDraggingRef = useRef(false);

  const getScaledCoordinates = (clientX: number, clientY: number) => {
    if (!canvasRef.current || !imageRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = imageRef.current.width / rect.width;
    const scaleY = imageRef.current.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const loadImage = (url: string, crossOrigin = true) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) {
        img.crossOrigin = 'anonymous';
      }
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      
      // If it's a URL (not a data URL), use a CORS proxy
      if (url.startsWith('http')) {
        img.src = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      } else {
        img.src = url;
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsLoading(true);
        const reader = new FileReader();
        
        const imageUrl = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        
        const img = await loadImage(imageUrl, false);
        imageRef.current = img;
        setImage(img.src);
        setState(initialState);
        setHistory([]);
        setHistoryIndex(-1);
        drawImage();
      } catch (error) {
        alert('Failed to load image. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUrlInput = async () => {
    const url = window.prompt('Enter image URL:');
    if (!url) return;

    try {
      setIsLoading(true);
      const img = await loadImage(url);
      imageRef.current = img;
      setImage(img.src);
      setState(initialState);
      setHistory([]);
      setHistoryIndex(-1);
      drawImage();
    } catch (error) {
      alert('Failed to load image. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ImageState, value: any) => {
    setState(prev => ({ ...prev, [key]: value }));
    drawImage();
    
    const timeoutId = setTimeout(() => {
      addToHistory();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  };

  const addToHistory = () => {
    if (!canvasRef.current) return;
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      canvas: canvasRef.current.toDataURL(),
      state: { ...state }
    });
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setState(prevState.state);
      setHistoryIndex(historyIndex - 1);
      
      loadImage(prevState.canvas, false).then(img => {
        imageRef.current = img;
        drawImage();
      });
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setState(nextState.state);
      setHistoryIndex(historyIndex + 1);
      
      loadImage(nextState.canvas, false).then(img => {
        imageRef.current = img;
        drawImage();
      });
    }
  };

  const applyCrop = async () => {
    if (!cropStart || !cropEnd || !canvasRef.current) return;

    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return;

    const startX = Math.min(cropStart.x, cropEnd.x);
    const startY = Math.min(cropStart.y, cropEnd.y);

    ctx.filter = `
      brightness(${state.brightness}%)
      contrast(${state.contrast}%)
      saturate(${state.saturation}%)
      blur(${state.blur}px)
      ${state.filter}
    `;

    ctx.drawImage(
      canvasRef.current,
      startX, startY, width, height,
      0, 0, width, height
    );

    try {
      const newImage = await loadImage(tempCanvas.toDataURL(), false);
      imageRef.current = newImage;
      setImage(newImage.src);
      
      // Clear crop state immediately
      setCropStart(null);
      setCropEnd(null);
      setIsCropping(false);
      setTool('adjust'); // Switch back to adjust tool after crop
      
      addToHistory();
      drawImage();
    } catch (error) {
      alert('Failed to apply crop. Please try again.');
    }
  };

  const removeImage = () => {
    setImage(null);
    setState(initialState);
    setHistory([]);
    setHistoryIndex(-1);
    imageRef.current = null;
    setCropStart(null);
    setCropEnd(null);
    setIsCropping(false);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const scrollFilters = (direction: 'left' | 'right') => {
    if (!filterContainerRef.current) return;
    const container = filterContainerRef.current;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    if (!imageRef.current) return;

    const generatePreviews = async () => {
      const previews: { [key: string]: string } = {};
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) return;

      const previewSize = 100;
      tempCanvas.width = previewSize;
      tempCanvas.height = previewSize;

      for (const filter of filters) {
        ctx.clearRect(0, 0, previewSize, previewSize);
        
        const aspectRatio = imageRef.current!.width / imageRef.current!.height;
        let drawWidth = previewSize;
        let drawHeight = previewSize;
        let offsetX = 0;
        let offsetY = 0;

        if (aspectRatio > 1) {
          drawHeight = previewSize / aspectRatio;
          offsetY = (previewSize - drawHeight) / 2;
        } else {
          drawWidth = previewSize * aspectRatio;
          offsetX = (previewSize - drawWidth) / 2;
        }

        ctx.filter = `
          brightness(${state.brightness}%)
          contrast(${state.contrast}%)
          saturate(${state.saturation}%)
          blur(${state.blur}px)
          ${filter.style}
        `;

        ctx.drawImage(imageRef.current!, offsetX, offsetY, drawWidth, drawHeight);
        previews[filter.name] = tempCanvas.toDataURL();
      }

      setFilterPreviews(previews);
    };

    generatePreviews();
  }, [image, state.brightness, state.contrast, state.saturation, state.blur]);

  useEffect(() => {
    if (tool === 'crop') {
      setIsCropping(true);
    } else {
      setIsCropping(false);
      setCropStart(null);
      setCropEnd(null);
    }
    drawImage();
  }, [tool]);

  const drawImage = (timestamp?: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !imageRef.current) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    canvas.width = imageRef.current.width;
    canvas.height = imageRef.current.height;

    ctx.filter = `
      brightness(${state.brightness}%)
      contrast(${state.contrast}%)
      saturate(${state.saturation}%)
      blur(${state.blur}px)
      ${state.filter}
    `;

    ctx.drawImage(imageRef.current, 0, 0);

    // Only draw crop overlay if we're actively cropping
    if (isCropping && cropStart && cropEnd) {
      const width = cropEnd.x - cropStart.x;
      const height = cropEnd.y - cropStart.y;

      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(cropStart.x, cropStart.y, width, height);
      ctx.fill('evenodd');

      // Animated dashed border
      if (isDraggingRef.current) {
        const dashOffset = (timestamp || 0) * 0.05;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = dashOffset;
        ctx.strokeRect(cropStart.x, cropStart.y, width, height);
        ctx.setLineDash([]);

        requestRef.current = requestAnimationFrame(drawImage);
      } else {
        // Solid border when not dragging
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(cropStart.x, cropStart.y, width, height);
      }

      // Corner handles
      const corners = [
        { x: cropStart.x, y: cropStart.y },
        { x: cropStart.x + width, y: cropStart.y },
        { x: cropStart.x, y: cropStart.y + height },
        { x: cropStart.x + width, y: cropStart.y + height }
      ];

      corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.stroke();
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCropping || !canvasRef.current) return;
    isDraggingRef.current = true;
    const coords = getScaledCoordinates(e.clientX, e.clientY);
    setCropStart(coords);
    setCropEnd(coords);
    requestRef.current = requestAnimationFrame(drawImage);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isCropping || !cropStart || !canvasRef.current || !isDraggingRef.current) return;
    const coords = getScaledCoordinates(e.clientX, e.clientY);
    setCropEnd(coords);
  };

  const handleMouseUp = () => {
    if (!isCropping || !cropStart || !cropEnd) return;
    isDraggingRef.current = false;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    
    if (width > 10 && height > 10) {
      applyCrop();
    } else {
      setCropStart(null);
      setCropEnd(null);
      drawImage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col lg:flex-row">
        <div className="w-full lg:w-16 bg-gray-50 dark:bg-gray-800 border-b lg:border-r dark:border-gray-700">
          <div className="flex lg:flex-col items-center justify-center py-4 space-x-4 lg:space-x-0 lg:space-y-4">
            <button
              onClick={() => setTool('crop')}
              className={`p-3 rounded-lg ${
                tool === 'crop' ? 'bg-purple-100 dark:bg-purple-900' : ''
              }`}
            >
              <Crop className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setTool('adjust')}
              className={`p-3 rounded-lg ${
                tool === 'adjust' ? 'bg-purple-100 dark:bg-purple-900' : ''
              }`}
            >
              <Sliders className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={() => setTool('filter')}
              className={`p-3 rounded-lg ${
                tool === 'filter' ? 'bg-purple-100 dark:bg-purple-900' : ''
              }`}
            >
              <Wand2 className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-4 lg:p-8">
          {!image ? (
            <div 
              ref={dropZoneRef}
              className="h-full flex flex-col items-center justify-center space-y-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg"
            >
              <div className="flex space-x-4">
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center space-y-4 px-6 py-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <Upload className="w-12 h-12 text-purple-600" />
                    <span className="text-gray-700 dark:text-gray-300">Upload Image</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </div>
                </label>
                <button
                  onClick={handleUrlInput}
                  className="flex flex-col items-center space-y-4 px-6 py-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                >
                  <Link className="w-12 h-12 text-purple-600" />
                  <span className="text-gray-700 dark:text-gray-300">Image URL</span>
                </button>
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                or drag and drop an image here
              </p>
            </div>
          ) : (
            <div 
              className="flex-1 relative flex items-center justify-center overflow-hidden"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
                </div>
              )}
              
              <button
                onClick={removeImage}
                className="absolute top-4 left-4 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="absolute top-4 right-4 flex space-x-2 z-10">
                <button
                  onClick={undo}
                  disabled={historyIndex <= 0}
                  className={`p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 ${
                    historyIndex <= 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Undo className="w-5 h-5" />
                </button>
                <button
                  onClick={redo}
                  disabled={historyIndex >= history.length - 1}
                  className={`p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 ${
                    historyIndex >= history.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Redo className="w-5 h-5" />
                </button>
              </div>

              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[calc(100vh-12rem)] object-contain"
                style={{
                  cursor: isCropping ? 'crosshair' : 'default'
                }}
              />
            </div>
          )}
        </div>

        {image && (
          <div className="w-full lg:w-72 bg-gray-50 dark:bg-gray-800 border-t lg:border-l dark:border-gray-700 p-4">
            {tool === 'adjust' && (
              <div className="space-y-6">
                <Slider
                  label="Brightness"
                  value={state.brightness}
                  onChange={(v) => handleFilterChange('brightness', v)}
                  min={0}
                  max={200}
                />
                <Slider
                  label="Contrast"
                  value={state.contrast}
                  onChange={(v) => handleFilterChange('contrast', v)}
                  min={0}
                  max={200}
                />
                <Slider
                  label="Saturation"
                  value={state.saturation}
                  onChange={(v) => handleFilterChange('saturation', v)}
                  min={0}
                  max={200}
                />
                <Slider
                  label="Blur"
                  value={state.blur}
                  onChange={(v) => handleFilterChange('blur', v)}
                  min={0}
                  max={20}
                />
                <Slider
                  label="Feather"
                  value={state.feather}
                  onChange={(v) => handleFilterChange('feather', v)}
                  min={0}
                  max={20}
                />
              </div>
            )}
            {tool === 'filter' && (
              <div className="space-y-6">
                <div className="relative">
                  <div 
                    ref={filterContainerRef}
                    className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide"
                    style={{ scrollBehavior: 'smooth' }}
                  >
                    {filters.map((filter) => (
                      <div
                        key={filter.name}
                        className={`flex-shrink-0 cursor-pointer ${
                          state.filter === filter.style ? 'ring-2 ring-purple-600' : ''
                        }`}
                        onClick={() => handleFilterChange('filter', filter.style)}
                      >
                        <div className="w-24 h-24 rounded-lg overflow-hidden">
                          <img
                            src={filterPreviews[filter.name]}
                            alt={filter.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <p className="text-center text-sm mt-2">{filter.name}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => scrollFilters('left')}
                    className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1 rounded-r"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => scrollFilters('right')}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-1 rounded-l"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={handleDownload}
              className="mt-6 w-full py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2"
            >
              <Download className="w-5 h-5" />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}