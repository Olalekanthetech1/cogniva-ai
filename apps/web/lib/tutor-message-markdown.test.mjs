import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [[rehypeKatex, {
  throwOnError: false,
  strict: "ignore",
  trust: false,
  maxExpand: 100,
  maxSize: 20,
  output: "htmlAndMathml"
}]];

function renderMarkdown(content) {
  return renderToStaticMarkup(createElement(
    ReactMarkdown,
    {
      remarkPlugins,
      rehypePlugins,
      components: {
        img({ alt }) {
          return alt ? createElement("span", null, "Image: " + alt) : null;
        }
      }
    },
    content
  ));
}

test("renders inline and display LaTeX as accessible mathematical markup", () => {
  const markdown = [
    "The resultant is $R^2 = F_1^2 + F_2^2 + 2F_1F_2\\cos(\\theta)$.",
    "",
    "$$",
    "F_1^2 + F_2^2 = 100",
    "$$",
    "",
    "The angle is $90^\\circ$."
  ].join("\n");
  const html = renderMarkdown(markdown);

  assert.match(html, /class="katex"/);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /mathml/);
  assert.doesNotMatch(html, /\$F_1\^2/);
});

test("renders GitHub-flavoured Markdown including tables and emphasis", () => {
  const html = renderMarkdown([
    "**Known values**",
    "",
    "| Condition | Result |",
    "| --- | --- |",
    "| Perpendicular | 10 N |",
    "| 60 degrees | 13 N |"
  ].join("\n"));

  assert.match(html, /<strong>Known values<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /Perpendicular/);
  assert.match(html, /60 degrees/);
});

test("does not render untrusted raw HTML or remote images", () => {
  const html = renderMarkdown(
    "Before <script>alert(1)</script> after.\n\n![tracking pixel](https://example.invalid/pixel.png)"
  );

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Image: tracking pixel/);
});

test("invalid TeX is shown safely without breaking the tutor message", () => {
  const html = renderMarkdown("Keep explaining: $\\notARealCommand{x}$.");
  assert.match(html, /#cc0000/);
  assert.match(html, /Keep explaining/);
});
