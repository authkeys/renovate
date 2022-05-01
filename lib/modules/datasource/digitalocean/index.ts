import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpHeaders } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { DoImagesResponse, DoK8sOptsResponse } from './types';

export class DigitalOceanDatasource extends Datasource {
  static readonly id = 'digitalocean';

  constructor() {
    super(DigitalOceanDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://api.digitalocean.com/'];

  override readonly caching = true;

  getHeaders(): HttpHeaders {
    return { Authorization: `Bearer ${process.env.DIGITALOCEAN_TOKEN}` };
  }

  async getK8sReleases(registryUrl: string): Promise<ReleaseResult | null> {
    const url = `${registryUrl}v2/kubernetes/options`;
    let result: ReleaseResult | null = null;
    try {
      const { options } = (
        await this.http.getJson<DoK8sOptsResponse>(url, {
          headers: this.getHeaders(),
        })
      ).body;
      if (options.versions.length === 0) {
        return null;
      }

      const releases = options.versions.map(({ slug }) => ({
        version: slug,
        newDigest: slug,
        isStable: true,
      }));

      result = { releases };
    } catch (err) {
      if (err.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }
    return result;
  }

  async getDropletReleases(
    registryUrl: string,
    distribution: string
  ): Promise<ReleaseResult | null> {
    const allImages = [];
    let imageCounter = 0;
    const fetchAllImages = async (page: number): Promise<void> => {
      const url = `${registryUrl}v2/images?page=${page}&per_page=200&type=distribution`;
      const { images, meta } = (
        await this.http.getJson<DoImagesResponse>(url, {
          headers: this.getHeaders(),
        })
      ).body;
      images
        .filter((image) => image.distribution.toLowerCase() === distribution)
        .map(({ slug }) => allImages.push(slug));
      imageCounter += images.length;
      if (imageCounter < meta.total) {
        await fetchAllImages(page + 1);
      }
    };

    let result: ReleaseResult | null = null;
    try {
      await fetchAllImages(1);
      const releases = allImages.map((slug) => ({
        version: slug,
        newDigest: slug,
        isStable: true,
      }));

      result = { releases };
    } catch (err) {
      if (err.statusCode !== 404) {
        throw new ExternalHostError(err);
      }
      this.handleGenericErrors(err);
    }
    return result;
  }

  @cache({
    namespace: 'datasource-do',
    key: (getReleasesConfig: GetReleasesConfig) =>
      getReleasesConfig.packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (packageName === 'k8s' || packageName === 'kubernetes') {
      return await this.getK8sReleases(registryUrl);
    } else if (packageName.startsWith('droplet/')) {
      const [, distribution] = packageName.split('/');
      return await this.getDropletReleases(registryUrl, distribution);
    }

    logger.warn(
      { dependency: packageName },
      `Unknown DO package ${packageName}`
    );

    return null;
  }
}
