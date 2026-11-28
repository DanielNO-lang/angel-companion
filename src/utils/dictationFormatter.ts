const DICTATION_COMMAND_PATTERN =
  /(new paragraph|next paragraph|paragraph break|new line|next line|line break|bullet point|bullet|numbered list|full stop|period|question mark|exclamation mark|exclamation point|comma|colon|semicolon|ellipsis|open quote|close quote|open parenthesis|close parenthesis)/gi;

function shouldCapitalizeNext(text: string): boolean {
  return !text.trim() || /[.!?]\s*$|\n\s*$/.test(text);
}

function appendRecognizedWords(current: string, words: string): string {
  const clean = words.replace(/[ \t\r\n]+/g, ' ').trim();
  if (!clean) return current;

  let next = current;
  const startsWithPunctuation = /^[,.;:!?)}\]”]/.test(clean);
  if (next && !/[ \n]$/.test(next) && !startsWithPunctuation && !/[([{“]$/.test(next)) {
    next += ' ';
  }

  const sentenceStart = shouldCapitalizeNext(next);
  const formatted = sentenceStart
    ? clean.replace(/^([a-z])/, (letter) => letter.toLocaleUpperCase())
    : clean;
  return next + formatted;
}

/**
 * Converts explicit spoken formatting commands into editable text.
 * Ordinary words are preserved; commands are applied only to finalized speech chunks.
 */
export function appendDictationText(previousText: string, recognizedChunk: string): string {
  let result = previousText.replace(/[ \t]+$/g, '');
  const parts = recognizedChunk.split(DICTATION_COMMAND_PATTERN);

  for (const part of parts) {
    if (!part) continue;
    const command = part.toLocaleLowerCase().trim();

    switch (command) {
      case 'new line':
      case 'next line':
      case 'line break':
        result = result.replace(/[ \t]+$/g, '') + '\n';
        break;
      case 'new paragraph':
      case 'next paragraph':
      case 'paragraph break':
        result = result.replace(/[ \t]+$/g, '') + '\n\n';
        break;
      case 'bullet point':
      case 'bullet':
        result = result.replace(/[ \t]+$/g, '');
        if (result && !result.endsWith('\n')) result += '\n';
        result += '• ';
        break;
      case 'numbered list':
        result = result.replace(/[ \t]+$/g, '');
        if (result && !result.endsWith('\n')) result += '\n';
        result += '1. ';
        break;
      case 'full stop':
      case 'period':
        result = result.replace(/[ \t]+$/g, '') + '.';
        break;
      case 'question mark':
        result = result.replace(/[ \t]+$/g, '') + '?';
        break;
      case 'exclamation mark':
      case 'exclamation point':
        result = result.replace(/[ \t]+$/g, '') + '!';
        break;
      case 'comma':
        result = result.replace(/[ \t]+$/g, '') + ',';
        break;
      case 'colon':
        result = result.replace(/[ \t]+$/g, '') + ':';
        break;
      case 'semicolon':
        result = result.replace(/[ \t]+$/g, '') + ';';
        break;
      case 'ellipsis':
        result = result.replace(/[ \t]+$/g, '') + '…';
        break;
      case 'open quote':
        result = result.replace(/[ \t]+$/g, '');
        if (result && !/[ \n]$/.test(result)) result += ' ';
        result += '“';
        break;
      case 'close quote':
        result = result.replace(/[ \t]+$/g, '') + '”';
        break;
      case 'open parenthesis':
        result = result.replace(/[ \t]+$/g, '');
        if (result && !/[ \n]$/.test(result)) result += ' ';
        result += '(';
        break;
      case 'close parenthesis':
        result = result.replace(/[ \t]+$/g, '') + ')';
        break;
      default:
        result = appendRecognizedWords(result, part);
    }
  }

  return result
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ');
}

export function combineDictationPreview(finalText: string, interimText: string): string {
  return `${finalText}${interimText}`
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
