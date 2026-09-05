export interface TextSpan {start: number; end: number}

export function placeholderSpans(text: string, placeholder: string): TextSpan[] {
    if(!placeholder) throw new Error('Text placeholder must not be empty');
    const spans: TextSpan[] = [];
    let start = text.indexOf(placeholder);
    while(start >= 0) {
        spans.push({start, end: start + placeholder.length});
        start = text.indexOf(placeholder, start + 1);
    }
    if(spans.length === 0) throw new Error(`Placeholder ${JSON.stringify(placeholder)} is absent from the original input`);
    return spans;
}

export function validateSpans(spans: readonly TextSpan[]): void {
    const sorted = [...spans].sort((a, b) => a.start - b.start);
    for(let i = 1; i < sorted.length; i++) {
        if(sorted[i]!.start < sorted[i - 1]!.end) throw new Error('Text placeholders overlap');
    }
}

export function replaceSpans(text: string, replacements: readonly (TextSpan & {value: string})[]): string {
    validateSpans(replacements);
    for(const {start, end, value} of [...replacements].sort((a, b) => b.start - a.start)) text = text.slice(0, start) + value + text.slice(end);
    return text;
}
