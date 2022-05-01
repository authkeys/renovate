import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import type { HttpHeaders } from '../../../util/http/types';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type { DoK8sOptsResponse } from './types';

export class DigitalOceanKubernetesDatasource extends Datasource {
  static readonly id = 'digitalocean-kubernetes';

  constructor() {
    super(DigitalOceanKubernetesDatasource.id);
  }

  override readonly customRegistrySupport = false;

  override readonly defaultRegistryUrls = ['https://api.digitalocean.com/'];

  override readonly caching = true;

  getHeaders(): HttpHeaders {
    return { Authorization: `Bearer ${process.env.DIGITALOCEAN_TOKEN}` };
  }

  @cache({
    namespace: 'datasource-kubernetes',
    key: (getReleasesConfig: GetReleasesConfig) =>
      getReleasesConfig.packageName,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
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
}
