const MATH_COMMAND = /\\[A-Za-z]+/;
const MATH_RELATION = /(?:=|≈|≃|≠|≤|≥|<|>)/;

function looksLikeMathExpression(value) {
  const candidate = value.trim();
  if (!candidate || candidate.length > 1000) return false;
  if (MATH_COMMAND.test(candidate)) return true;

  return (
    MATH_RELATION.test(candidate) &&
    /[A-Za-z0-9]/.test(candidate) &&
    /(?:\^|_)/.test(candidate)
  );
}

function protectCode(markdown) {
  const protectedBlocks = [];
  let output = "";
  const lines = markdown.match(/[^\n]*\n|[^\n]+$/g) ?? [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opening = line.match(/^ {0,3}(\`{3,}|~{3,})/);

    if (!opening) {
      output += line;
      continue;
    }

    const marker = opening[1];
    const markerCharacter = marker[0];
    const minimumLength = marker.length;
    let block = line;

    for (index += 1; index < lines.length; index += 1) {
      const candidate = lines[index];
      block += candidate;
      const closing = candidate.match(/^ {0,3}(\`+|~+)[ \t]*(?:\r?\n)?$/);

      if (
        closing &&
        closing[1][0] === markerCharacter &&
        closing[1].length >= minimumLength
      ) {
        break;
      }
    }

    protectedBlocks.push(block);
    output += "\uE000CGFENCE" + (protectedBlocks.length - 1) + "\uE001";
  }

  output = output.replace(/(\`+)([\s\S]*?)\1/g, (match) => {
    protectedBlocks.push(match);
    return "\uE000CGINLINE" + (protectedBlocks.length - 1) + "\uE001";
  });

  return {
    markdown: output,
    restore(value) {
      return value.replace(/\uE000CG(?:FENCE|INLINE)(\d+)\uE001/g, (_match, index) =>
        protectedBlocks[Number(index)] ?? _match
      );
    }
  };
}

function moveTrailingPunctuationOutsideMath(expression) {
  const match = expression.match(/[.,;:!?]+$/);
  if (!match) return { expression, punctuation: "" };

  const punctuationStart = expression.length - match[0].length;
  const previousCharacter = expression[punctuationStart - 1];
  if (previousCharacter === "\\") return { expression, punctuation: "" };

  return {
    expression: expression.slice(0, punctuationStart).trimEnd(),
    punctuation: match[0]
  };
}

/**
 * Normalize common provider math conventions into remark-math delimiters.
 * Only the displayed copy is changed; persisted provider text remains intact.
 */
export function normalizeTutorMathMarkdown(markdown) {
  if (typeof markdown !== "string" || markdown.length === 0) return markdown;

  const protectedContent = protectCode(markdown);
  let normalized = protectedContent.markdown;

  // TeX's standard inline and display delimiters are not enabled by remark-math.
  normalized = normalized
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, expression) =>
      "$$\n" + expression.trim() + "\n$$"
    )
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, expression) =>
      "$" + expression.replace(/\s*\n\s*/g, " ").trim() + "$"
    );

  // Some model responses use square brackets as informal math delimiters.
  // Convert only un-nested, single-line bracket contents with clear math syntax;
  // ordinary citations, array-like values, and Markdown links remain unchanged.
  normalized = normalized.replace(/\[([^\[\]\n]{2,1000})\](?!\()/g, (match, content) => {
    const candidate = content.trim();
    if (!looksLikeMathExpression(candidate)) return match;

    const { expression, punctuation } = moveTrailingPunctuationOutsideMath(candidate);
    if (!expression) return match;

    return "$" + expression + "$" + punctuation;
  });

  return protectedContent.restore(normalized);
}
