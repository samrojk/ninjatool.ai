export interface ImageState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  feather: number;
  filter: string;
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export type Tool = 'crop' | 'adjust' | 'filter' | 'effects';

export interface Filter {
  name: string;
  style: string;
}