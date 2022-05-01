<!-- prettier-ignore -->
!!! warning
    This datasource is experimental.
    Its syntax and behavior may change at any time!

This datasource returns the latest [Digital Ocean k8s versions](https://docs.digitalocean.com/reference/api/api-reference/#operation/list_kubernetes_options) via the DO API.

You must use common DO configuration option:

- Provide token via `DIGITALOCEAN_TOKEN` environment variable

At the moment, this datasource has no "manager".
You have to use the regex manager for this.

**Usage Example**

Here's an example of using the regex manager:

```javascript
module.exports = {
  regexManagers: [
    {
      description: ['Update DO k8s version'],
      fileMatch: ['\\.tf$'],
      matchStrings: [
        '# renovate: datasource=(?<datasource>[a-z-]+?)(?: depName=(?<depName>.+?))(?: lookupName=(?<packageName>.+?))?(?: versioning=(?<versioning>[a-z-]+?))?\\s+[a-z0-9_]+\\s*=\\s*"(?<currentValue>.+?)"\\s+',
      ],
      versioningTemplate: 'digitalocean-kubernetes',
    },
  ],
};
```

Or as JSON:

```json
{
  "regexManagers": [
    {
      "description": ["Update DO version"],
      "fileMatch": ["\\.tf$"],
      "matchStrings": [
        "# renovate: datasource=(?<datasource>[a-z-]+?)(?: depName=(?<depName>.+?))(?: lookupName=(?<packageName>.+?))?(?: versioning=(?<versioning>[a-z-]+?))?\\s+[a-z0-9_]+\\s*=\\s*\"(?<currentValue>.+?)\"\\s+"
      ],
      "versioningTemplate": "{{#if versioning}}{{versioning}}{{else}}semver{{/if}}"
    }
  ]
}
```

This would match every file with tf extension, and would recognize the following lines:

```hcl

resource "digitalocean_kubernetes_cluster" "k8s_a1" {
  name          = "k8s-ams3-a1"
  auto_upgrade  = false
  region        = var.do_region
  surge_upgrade = true
  tags          = [var.do_tags, "a1"]
  # renovate: datasource=digitalocean depName=k8s
  version       = "1.21.1"

  node_pool {
    name       = "pool-7sxv82swl"
    node_count = 2
    size       = "s-4vcpu-8gb"
    tags       = [var.do_tags, "a1"]
  }
}

```
