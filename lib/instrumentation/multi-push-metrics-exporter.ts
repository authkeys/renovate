/*
 * Copyright Fluidware srl
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ExportResult } from '@opentelemetry/core';
import type { PushMetricExporter, ResourceMetrics } from '@opentelemetry/sdk-metrics';

export class MultiPushMetricExporter implements PushMetricExporter {
  private readonly _exporters: PushMetricExporter[];

  constructor(exporters: PushMetricExporter[]) {
    this._exporters = exporters;
  }

  export(
    metrics: ResourceMetrics,
    resultCallback: (result: ExportResult) => void,
  ): void {
    this._exporters.forEach((exporter) => {
      exporter.export(metrics, resultCallback);
    });
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this._exporters.map((exporter) => exporter.forceFlush()));
  }

  async shutdown(): Promise<void> {
    await Promise.all(this._exporters.map((exporter) => exporter.shutdown()));
  }
}
