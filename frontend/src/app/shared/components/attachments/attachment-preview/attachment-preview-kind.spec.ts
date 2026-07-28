import { attachmentPreviewKind } from './attachment-preview-kind';

describe('attachmentPreviewKind', () => {
  it('returns "pdf" for application/pdf', () => {
    expect(attachmentPreviewKind('application/pdf')).toBe('pdf');
  });

  it('returns "unsupported" for image content types', () => {
    expect(attachmentPreviewKind('image/png')).toBe('unsupported');
  });

  it('returns "unsupported" for text content types', () => {
    expect(attachmentPreviewKind('text/plain')).toBe('unsupported');
  });

  it('returns "unsupported" for video content types', () => {
    expect(attachmentPreviewKind('video/mp4')).toBe('unsupported');
  });

  it('returns "unsupported" for xlsx content types', () => {
    expect(attachmentPreviewKind('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('unsupported');
  });

  it('returns "unsupported" when the content type is undefined', () => {
    expect(attachmentPreviewKind(undefined)).toBe('unsupported');
  });

  it('is case-insensitive and ignores charset parameters', () => {
    expect(attachmentPreviewKind('APPLICATION/PDF')).toBe('pdf');
    expect(attachmentPreviewKind('application/pdf; charset=binary')).toBe('pdf');
    expect(attachmentPreviewKind('text/plain; charset=utf-8')).toBe('unsupported');
  });
});
