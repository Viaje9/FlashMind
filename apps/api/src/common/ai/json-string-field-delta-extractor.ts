export class JsonStringFieldDeltaExtractor {
  private readonly prefix: string;
  private buffer = '';
  private inValue = false;
  private escaping = false;

  constructor(fieldName: string) {
    this.prefix = `"${fieldName}":`;
  }

  push(delta: string): string[] {
    this.buffer += delta;
    const output: string[] = [];

    while (this.buffer.length > 0) {
      if (!this.inValue) {
        const prefixIndex = this.buffer.indexOf(this.prefix);
        if (prefixIndex === -1) {
          this.buffer = this.buffer.slice(
            Math.max(0, this.buffer.length - this.prefix.length),
          );
          break;
        }

        const valueStart = this.buffer.indexOf(
          '"',
          prefixIndex + this.prefix.length,
        );
        if (valueStart === -1) {
          this.buffer = this.buffer.slice(prefixIndex);
          break;
        }

        this.buffer = this.buffer.slice(valueStart + 1);
        this.inValue = true;
      }

      let chunk = '';
      let consumed = 0;

      for (; consumed < this.buffer.length; consumed += 1) {
        const char = this.buffer[consumed];

        if (this.escaping) {
          chunk += this.decodeEscapedChar(char);
          this.escaping = false;
          continue;
        }

        if (char === '\\') {
          this.escaping = true;
          continue;
        }

        if (char === '"') {
          this.buffer = this.buffer.slice(consumed + 1);
          this.inValue = false;
          if (chunk) output.push(chunk);
          return output;
        }

        chunk += char;
      }

      this.buffer = '';
      if (chunk) output.push(chunk);
      break;
    }

    return output;
  }

  private decodeEscapedChar(char: string): string {
    if (char === 'n') return '\n';
    if (char === 'r') return '\r';
    if (char === 't') return '\t';
    if (char === '"') return '"';
    if (char === '\\') return '\\';
    return char;
  }
}
