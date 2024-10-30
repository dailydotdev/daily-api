import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs/promises';

interface Span {
  spanId: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface Trace {
  projectId: string;
  traceId: string;
  spans: Span[];
}

interface TracesResponse {
  traces?: Trace[];
  nextPageToken?: string;
}

interface SpanTiming {
  startTime: string;
  durationMs: number;
}

class CloudTraceAnalyzer {
  private projectId?: string;
  private baseUrl: string;
  private getAccessToken: (() => Promise<string>) | null = null;

  constructor(projectId?: string) {
    this.projectId = projectId;
    this.baseUrl = 'https://cloudtrace.googleapis.com/v1';
  }

  async initialize(): Promise<void> {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = (await auth.getClient()) as OAuth2Client;

    if (!this.projectId) {
      this.projectId = await auth.getProjectId();
    }

    this.getAccessToken = async () => {
      const token = await client.getAccessToken();
      return token.token || '';
    };
  }

  async *getTraces(
    startTime: Date,
    endTime: Date,
    filter: string = '',
    pageSize: number = 100,
  ): AsyncGenerator<Trace[]> {
    if (!this.getAccessToken) {
      throw new Error('Analyzer not initialized. Call initialize() first.');
    }

    let nextPageToken = '';

    do {
      console.log('fetching page...');
      const token = await this.getAccessToken();
      const params = new URLSearchParams({
        pageSize: pageSize.toString(),
        pageToken: nextPageToken,
        filter,
        orderBy: 'start desc',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        view: 'COMPLETE',
      });

      const response = await fetch(
        `${this.baseUrl}/projects/${this.projectId}/traces?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.log('rate limit exceeded, breaking');
          break;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TracesResponse = await response.json();
      if (data.traces) {
        yield data.traces;
      }
      nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);
  }

  async exportSpanTimings(
    traces: AsyncGenerator<Trace[]>,
    spanName: string,
    outputPath: string,
  ): Promise<void> {
    const timings: SpanTiming[] = [];

    for await (const page of traces) {
      if (page) {
        for (const trace of page) {
          for (const span of trace.spans) {
            if (span.name === spanName) {
              const spanTiming = this.processSpan(span);
              timings.push(spanTiming);
            }
          }
        }
      }
    }

    const csv = this.convertToCSV(timings);
    await fs.writeFile(path.resolve(outputPath), csv);
  }

  private processSpan(span: Span): SpanTiming {
    return {
      startTime: span.startTime,
      durationMs: this.calculateDurationMs(span.startTime, span.endTime),
    };
  }

  private calculateDurationMs(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return end - start;
  }

  private convertToCSV(timings: SpanTiming[]): string {
    const header = 'startTime,durationMs\n';
    const rows = timings.map(
      (timing) => `${timing.startTime},${timing.durationMs}`,
    );
    return header + rows.join('\n');
  }
}

async function analyzeTraces(): Promise<void> {
  const analyzer = new CloudTraceAnalyzer();
  await analyzer.initialize();

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  try {
    const spanName = 'FeedPreferencesConfigGenerator';
    const traces = analyzer.getTraces(
      startTime,
      endTime,
      `+span:${spanName}`,
      1000,
    );
    await analyzer.exportSpanTimings(traces, spanName, 'span_timings.csv');
  } catch (error) {
    console.error(
      'Error analyzing traces:',
      error instanceof Error ? error.message : error,
    );
  }
}

analyzeTraces()
  .then(() => process.exit())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
