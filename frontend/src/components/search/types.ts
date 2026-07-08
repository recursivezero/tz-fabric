export type NotificationState = { message: string; type: "success" | "error" } | null;
export type DbOp = "create" | "update" | null;

export interface ResultItem {
  imageSrc: string;
  filename: string;
  audioSrc?: string;
}

export interface SearchApiResponse {
  message: string;
  results: string[];
  pagination: {
    page: number;
    per_page: number;
    total_results: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export type CropRect = { x: number; y: number; w: number; h: number };
