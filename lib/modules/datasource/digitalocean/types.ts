interface DoNameSlug {
  name: string;
  slug: string;
}

interface DoK8sVersion {
  slug: string;
  kubernetes_version: string;
  supported_features: string[];
}

interface DoK8sOptions {
  regions: DoNameSlug[];
  versions: DoK8sVersion[];
  sizes: DoNameSlug[];
}

export interface DoK8sOptsResponse {
  options: DoK8sOptions;
}

interface DoMeta {
  total: number;
}

interface DoLinks {
  pages: DoLinksPages;
}

interface DoLinksPages {
  first: string;
  prev: string;
}

interface DoImage {
  id: number;
  name: string;
  distribution: string;
  slug: string;
  public: boolean;
  regions: string[];
  created_at: Date;
  min_disk_size: number;
  type: string;
  size_gigabytes: number;
  description: string;
  tags: string[];
  status: string;
  error_message: string;
}

export interface DoImagesResponse {
  meta: DoMeta;
  links: DoLinks;
  images: DoImage[];
}
