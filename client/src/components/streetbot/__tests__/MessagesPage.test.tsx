/**
 * Tests for MessagesPage — the messages/chat iframe wrapper.
 *
 * The MessagesPage component renders an iframe pointing to the SBP messages UI.
 *
 * Tests cover:
 * - Renders without crashing
 * - Contains an iframe element
 * - Iframe has the correct src URL
 * - Iframe has proper styling (full width/height, no border)
 * - Iframe has accessible title attribute
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import MessagesPage from '~/components/streetbot/messages/page';

describe('MessagesPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<MessagesPage />);
    expect(container).toBeTruthy();
  });

  it('renders an iframe element', () => {
    render(<MessagesPage />);
    const iframe = screen.getByTitle('Messages');
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe('IFRAME');
  });

  it('iframe points to the SBP messages URL', () => {
    render(<MessagesPage />);
    const iframe = screen.getByTitle('Messages') as HTMLIFrameElement;
    expect(iframe.src).toContain('http://localhost:3000/messages');
  });

  it('iframe has no border', () => {
    render(<MessagesPage />);
    const iframe = screen.getByTitle('Messages') as HTMLIFrameElement;
    expect(iframe.style.border).toBe('none');
  });

  it('iframe fills its container (100% width and height)', () => {
    render(<MessagesPage />);
    const iframe = screen.getByTitle('Messages') as HTMLIFrameElement;
    expect(iframe.style.width).toBe('100%');
    expect(iframe.style.height).toBe('100%');
  });

  it('iframe is absolutely positioned', () => {
    render(<MessagesPage />);
    const iframe = screen.getByTitle('Messages') as HTMLIFrameElement;
    expect(iframe.style.position).toBe('absolute');
    expect(iframe.style.top).toBe('0px');
    expect(iframe.style.left).toBe('0px');
  });

  it('wrapper div has relative positioning', () => {
    const { container } = render(<MessagesPage />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.position).toBe('relative');
    expect(wrapper.style.width).toBe('100%');
    expect(wrapper.style.height).toBe('100%');
  });
});
