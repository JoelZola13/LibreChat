import React, { memo, useMemo, useRef, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { useToastContext } from '@librechat/client';
import { PermissionTypes, Permissions, apiBaseUrl } from 'librechat-data-provider';
import MermaidErrorBoundary from '~/components/Messages/Content/MermaidErrorBoundary';
import CodeBlock from '~/components/Messages/Content/CodeBlock';
import Mermaid from '~/components/Messages/Content/Mermaid';
import StreetBotServiceResults from '~/components/Chat/Messages/Content/StreetBotServiceResults';
import useHasAccess from '~/hooks/Roles/useHasAccess';
import { useFileDownload } from '~/data-provider';
import { useCodeBlockContext } from '~/Providers';
import { isStreetBot } from '~/config/appVariant';
import { hasServiceResults } from '~/utils/streetbotService';
import { handleDoubleClick } from '~/utils';
import { useLocalize } from '~/hooks';
import store from '~/store';

type TCodeProps = {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
};

const getCodeContent = (children: React.ReactNode): string => {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children
      .map((child) => (typeof child === 'string' ? child : String(child ?? '')))
      .join('');
  }
  return String(children ?? '');
};

const getLanguageName = (className?: string): string | undefined => {
  return /language-([^\s]+)/.exec(className ?? '')?.[1];
};

const isStreetBotServiceResultBlock = (className: string | undefined, content: string): boolean => {
  if (!isStreetBot) {
    return false;
  }
  const languageName = getLanguageName(className);
  return (
    languageName === 'streetbot-service-results' ||
    (languageName === 'streetbot' && hasServiceResults(content))
  );
};

export const code: React.ElementType = memo(({ className, children }: TCodeProps) => {
  const canRunCode = useHasAccess({
    permissionType: PermissionTypes.RUN_CODE,
    permission: Permissions.USE,
  });
  const languageName = getLanguageName(className);
  const lang = languageName?.split('-')[0];
  const isMath = lang === 'math';
  const isMermaid = lang === 'mermaid';
  const content = getCodeContent(children);
  const isSingleLine = content.split('\n').length === 1;

  const { getNextIndex, resetCounter } = useCodeBlockContext();
  const blockIndex = useRef(getNextIndex(isMath || isMermaid || isSingleLine)).current;

  useEffect(() => {
    resetCounter();
  }, [children, resetCounter]);

  if (isMath) {
    return <>{children}</>;
  } else if (isMermaid) {
    return (
      <MermaidErrorBoundary code={content}>
        <Mermaid id={`mermaid-${blockIndex}`}>{content}</Mermaid>
      </MermaidErrorBoundary>
    );
  } else if (!isSingleLine && isStreetBotServiceResultBlock(className, content)) {
    return <StreetBotServiceResults raw={content} />;
  } else if (isSingleLine) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return (
      <CodeBlock
        lang={lang ?? 'text'}
        codeChildren={children}
        blockIndex={blockIndex}
        allowExecution={canRunCode}
      />
    );
  }
});

export const codeNoExecution: React.ElementType = memo(({ className, children }: TCodeProps) => {
  const languageName = getLanguageName(className);
  const lang = languageName?.split('-')[0];
  const content = getCodeContent(children);

  if (lang === 'math') {
    return children;
  } else if (lang === 'mermaid') {
    return <Mermaid>{content}</Mermaid>;
  } else if (content.split('\n').length > 1 && isStreetBotServiceResultBlock(className, content)) {
    return <StreetBotServiceResults raw={content} />;
  } else if (content.split('\n').length === 1) {
    return (
      <code onDoubleClick={handleDoubleClick} className={className}>
        {children}
      </code>
    );
  } else {
    return <CodeBlock lang={lang ?? 'text'} codeChildren={children} allowExecution={false} />;
  }
});

type TAnchorProps = {
  href: string;
  children: React.ReactNode;
};

export const a: React.ElementType = memo(({ href, children }: TAnchorProps) => {
  const user = useRecoilValue(store.user);
  const { showToast } = useToastContext();
  const localize = useLocalize();

  const {
    file_id = '',
    filename = '',
    filepath,
  } = useMemo(() => {
    const pattern = new RegExp(`(?:files|outputs)/${user?.id}/([^\\s]+)`);
    const match = href.match(pattern);
    if (match && match[0]) {
      const path = match[0];
      const parts = path.split('/');
      const name = parts.pop();
      const file_id = parts.pop();
      return { file_id, filename: name, filepath: path };
    }
    return { file_id: '', filename: '', filepath: '' };
  }, [user?.id, href]);

  const { refetch: downloadFile } = useFileDownload(user?.id ?? '', file_id);
  const props: { target?: string; onClick?: React.MouseEventHandler } = { target: '_blank' };

  if (!file_id || !filename) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  const handleDownload = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      const stream = await downloadFile();
      if (stream.data == null || stream.data === '') {
        console.error('Error downloading file: No data found');
        showToast({
          status: 'error',
          message: localize('com_ui_download_error'),
        });
        return;
      }
      const link = document.createElement('a');
      link.href = stream.data;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(stream.data);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  props.onClick = handleDownload;
  props.target = '_blank';

  const domainServerBaseUrl = `${apiBaseUrl()}/api`;

  return (
    <a
      href={
        filepath?.startsWith('files/')
          ? `${domainServerBaseUrl}/${filepath}`
          : `${domainServerBaseUrl}/files/${filepath}`
      }
      {...props}
    >
      {children}
    </a>
  );
});

type TParagraphProps = {
  children: React.ReactNode;
};

export const p: React.ElementType = memo(({ children }: TParagraphProps) => {
  return <p className="mb-2 whitespace-pre-wrap">{children}</p>;
});

type TImageProps = {
  src?: string;
  alt?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
};

export const img: React.ElementType = memo(({ src, alt, title, className, style }: TImageProps) => {
  // Get the base URL from the API endpoints
  const baseURL = apiBaseUrl();

  // If src starts with /images/, prepend the base URL
  const fixedSrc = useMemo(() => {
    if (!src) return src;

    // If it's already an absolute URL or doesn't start with /images/, return as is
    if (src.startsWith('http') || src.startsWith('data:') || !src.startsWith('/images/')) {
      return src;
    }

    // Prepend base URL to the image path
    return `${baseURL}${src}`;
  }, [src, baseURL]);

  // Render video files as <video> elements with controls and audio
  const isVideo = useMemo(() => {
    if (!fixedSrc) return false;
    const url = fixedSrc.split('?')[0].toLowerCase();
    return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
  }, [fixedSrc]);

  // Render audio files as <audio> elements with controls
  const isAudio = useMemo(() => {
    if (!fixedSrc) return false;
    const url = fixedSrc.split('?')[0].toLowerCase();
    return url.endsWith('.wav') || url.endsWith('.mp3') || url.endsWith('.ogg');
  }, [fixedSrc]);

  if (isVideo) {
    return (
      <video
        src={fixedSrc}
        controls
        style={{ maxWidth: '100%', borderRadius: '8px', ...style }}
        className={className}
        title={title}
      >
        {alt}
      </video>
    );
  }

  if (isAudio) {
    return (
      <audio
        src={fixedSrc}
        controls
        style={{ width: '100%', ...style }}
        className={className}
        title={title}
      >
        {alt}
      </audio>
    );
  }

  return <img src={fixedSrc} alt={alt} title={title} className={className} style={style} />;
});
