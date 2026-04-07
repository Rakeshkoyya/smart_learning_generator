declare module "mammoth" {
  interface ConversionResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface Input {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }

  export function convertToHtml(input: Input): Promise<ConversionResult>;
  export function extractRawText(input: Input): Promise<ConversionResult>;
}
