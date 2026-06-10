import React, { memo, useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import supersub from 'remark-supersub';
import rehypeKatex from 'rehype-katex';
import { useRecoilValue } from 'recoil';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkDirective from 'remark-directive';
import type { Pluggable } from 'unified';
import { Citation, CompositeCitation, HighlightedText } from '~/components/Web/Citation';
import {
  mcpUIResourcePlugin,
  MCPUIResource,
  MCPUIResourceCarousel,
} from '~/components/MCPUIResource';
import { Artifact, artifactPlugin } from '~/components/Artifacts/Artifact';
import { ArtifactProvider, CodeBlockProvider } from '~/Providers';
import MarkdownErrorBoundary from './MarkdownErrorBoundary';
import { langSubset, preprocessLaTeX } from '~/utils';
import { unicodeCitation } from '~/components/Web';
import { code, pre, a, p, img } from './MarkdownComponents';
import StreetBotServiceResults from './StreetBotServiceResults';
import StreetBotAgentResults from './StreetBotAgentResults';
import StreetProfileResults from './StreetProfileResults';
import StreetProfileMessageDraft from './StreetProfileMessageDraft';
import { isStreetBot } from '~/config/appVariant';
import store from '~/store';

type TContentProps = {
  content: string;
  isLatestMessage: boolean;
};

type TMarkdownPart =
  | { type: 'markdown'; content: string }
  | { type: 'streetbot-service-results'; content: string }
  | { type: 'streetbot-agent-results'; content: string }
  | { type: 'street-profile-results'; content: string }
  | { type: 'street-profile-message-draft'; content: string };

const STREETBOT_RICH_FENCE =
  /```(streetbot-service-results|streetbot-agent-results|street-profile-results|street-profile-message-draft)\s*([\s\S]*?)```/gi;

const splitStreetBotRichBlocks = (content: string): TMarkdownPart[] | null => {
  if (
    !isStreetBot ||
    (!content.includes('```streetbot-service-results') &&
      !content.includes('```streetbot-agent-results') &&
      !content.includes('```street-profile-results') &&
      !content.includes('```street-profile-message-draft'))
  ) {
    return null;
  }

  const parts: TMarkdownPart[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  STREETBOT_RICH_FENCE.lastIndex = 0;
  while ((match = STREETBOT_RICH_FENCE.exec(content)) !== null) {
    const [fullMatch, language = '', payload = ''] = match;
    const start = match.index;
    if (start > lastIndex) {
      const markdown = content.slice(lastIndex, start).trimEnd();
      if (markdown.trim()) {
        parts.push({ type: 'markdown', content: markdown });
      }
    }
    parts.push({ type: language as TMarkdownPart['type'], content: payload.trim() });
    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < content.length) {
    const markdown = content.slice(lastIndex).trimStart();
    if (markdown.trim()) {
      parts.push({ type: 'markdown', content: markdown });
    }
  }

  return parts.length ? parts : null;
};

const Markdown = memo(({ content = '', isLatestMessage }: TContentProps) => {
  const LaTeXParsing = useRecoilValue<boolean>(store.LaTeXParsing);
  const isInitializing = content === '';

  const currentContent = useMemo(() => {
    if (isInitializing) {
      return '';
    }
    return LaTeXParsing ? preprocessLaTeX(content) : content;
  }, [content, LaTeXParsing, isInitializing]);

  const rehypePlugins = useMemo(
    () => [
      [rehypeKatex],
      [
        rehypeHighlight,
        {
          detect: true,
          ignoreMissing: true,
          subset: langSubset,
        },
      ],
    ],
    [],
  );

  const remarkPlugins: Pluggable[] = [
    supersub,
    remarkGfm,
    remarkDirective,
    artifactPlugin,
    [remarkMath, { singleDollarTextMath: false }],
    unicodeCitation,
    mcpUIResourcePlugin,
  ];

  if (isInitializing) {
    return (
      <div className="absolute">
        <p className="relative">
          <span className={isLatestMessage ? 'result-thinking' : ''} />
        </p>
      </div>
    );
  }

  const streetBotParts = splitStreetBotRichBlocks(currentContent);

  const renderMarkdown = (markdownContent: string, key?: React.Key) => (
    <ReactMarkdown
      key={key}
      /** @ts-ignore */
      remarkPlugins={remarkPlugins}
      /* @ts-ignore */
      rehypePlugins={rehypePlugins}
      components={
        {
          code,
          pre,
          a,
          p,
          img,
          artifact: Artifact,
          citation: Citation,
          'highlighted-text': HighlightedText,
          'composite-citation': CompositeCitation,
          'mcp-ui-resource': MCPUIResource,
          'mcp-ui-carousel': MCPUIResourceCarousel,
        } as {
          [nodeType: string]: React.ElementType;
        }
      }
    >
      {markdownContent}
    </ReactMarkdown>
  );

  return (
    <MarkdownErrorBoundary content={content} codeExecution={true}>
      <ArtifactProvider>
        <CodeBlockProvider>
          {streetBotParts
            ? streetBotParts.map((part, index) =>
                part.type === 'streetbot-service-results' ? (
                  <StreetBotServiceResults key={`streetbot-services-${index}`} raw={part.content} />
                ) : part.type === 'streetbot-agent-results' ? (
                  <StreetBotAgentResults
                    key={`streetbot-agent-results-${index}`}
                    raw={part.content}
                  />
                ) : part.type === 'street-profile-results' ? (
                  <StreetProfileResults
                    key={`street-profile-results-${index}`}
                    raw={part.content}
                  />
                ) : part.type === 'street-profile-message-draft' ? (
                  <StreetProfileMessageDraft
                    key={`street-profile-message-draft-${index}`}
                    raw={part.content}
                  />
                ) : (
                  renderMarkdown(part.content, `markdown-${index}`)
                ),
              )
            : renderMarkdown(currentContent)}
        </CodeBlockProvider>
      </ArtifactProvider>
    </MarkdownErrorBoundary>
  );
});

export default Markdown;
