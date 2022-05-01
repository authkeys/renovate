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
