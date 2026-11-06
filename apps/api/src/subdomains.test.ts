import { describe, expect, it } from 'vitest';
import { subdomainsOf } from './subdomains.js';

const site = (name: string, host: string, status: 'ok' | 'warn' | 'fail' | null) =>
  ({ id: name, name, url: `https://${host}/`, host, status });

describe('subdomainsOf', () => {
  it('lists hosts under the domain, sorted, and leaves out the domain itself and look-alikes', () => {
    const result = subdomainsOf('example.com', [
      site('Root', 'example.com', 'ok'),
      site('Blog', 'blog.example.com', 'ok'),
      site('Admin', 'admin.example.com', 'ok'),
      site('Look-alike', 'notexample.com', 'fail'),
    ]);
    expect(result.map((s) => s.host)).toEqual(['admin.example.com', 'blog.example.com']);
  });

  it('merges targets on the same host and reports the worst status', () => {
    const [only] = subdomainsOf('example.com', [site('Blog', 'blog.example.com', 'ok'), site('Blog panel', 'blog.example.com', 'fail')]);
    expect(only).toMatchObject({ host: 'blog.example.com', status: 'fail' });
    expect(only?.targets.map((t) => t.name)).toEqual(['Blog', 'Blog panel']);
  });

  it('has unknown status until something has been checked', () => {
    expect(subdomainsOf('example.com', [site('Blog', 'blog.example.com', null)])[0]?.status).toBeNull();
  });
});
