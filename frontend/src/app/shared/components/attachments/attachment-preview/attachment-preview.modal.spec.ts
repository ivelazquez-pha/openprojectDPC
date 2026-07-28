//-- copyright
// OpenProject is an open source project management software.
// Copyright (C) the OpenProject GmbH
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See COPYRIGHT and LICENSE files for more details.
//++

import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { OpModalLocalsToken } from 'core-app/shared/components/modal/modal.service';
import { IAttachment } from 'core-app/core/state/attachments/attachment.model';
import { OpAttachmentPreviewModalComponent } from './attachment-preview.modal';

describe('OpAttachmentPreviewModalComponent', () => {
  function buildAttachment(contentType:string):IAttachment {
    return {
      id: 1,
      title: 'file.pdf',
      status: 'uploaded',
      fileName: 'file.pdf',
      fileSize: 1234,
      description: { raw: '' } as unknown as IAttachment['description'],
      contentType,
      digest: 'abc123',
      createdAt: '2026-01-01T00:00:00Z',
      _links: {
        self: { href: '/api/v3/attachments/1' },
        delete: { href: '/api/v3/attachments/1' },
        container: { href: '/api/v3/work_packages/1' },
        author: { href: '/api/v3/users/1' },
        downloadLocation: { href: '/api/v3/attachments/1/content' },
        staticDownloadLocation: { href: '/attachments/1/file.pdf' },
        originOpen: undefined as unknown as IAttachment['_links']['originOpen'],
      },
    } as IAttachment;
  }

  function buildComponent(attachment:IAttachment, triggerElement?:HTMLElement) {
    const locals = {
      service: { close: vi.fn() },
      attachment,
      triggerElement,
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: OpModalLocalsToken, useValue: locals },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
        { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } },
        {
          provide: DomSanitizer,
          useValue: { bypassSecurityTrustResourceUrl: vi.fn((url:string) => `safe:${url}`) },
        },
      ],
    });

    return TestBed.runInInjectionContext(() => new OpAttachmentPreviewModalComponent());
  }

  afterEach(() => TestBed.resetTestingModule());

  it('resolves the "pdf" preview kind for application/pdf attachments', () => {
    const component = buildComponent(buildAttachment('application/pdf'));

    expect(component.previewKind).toBe('pdf');
  });

  it('resolves the "unsupported" preview kind for any other content type', () => {
    const component = buildComponent(buildAttachment('image/png'));

    expect(component.previewKind).toBe('unsupported');
  });

  it('builds the content URL from the static download location', () => {
    const component = buildComponent(buildAttachment('application/pdf'));

    expect(component.contentUrl).toBe('/attachments/1/file.pdf');
  });

  it('builds the download URL with the force-download disposition parameter', () => {
    const component = buildComponent(buildAttachment('application/pdf'));

    expect(component.downloadUrl).toBe('/attachments/1/file.pdf?disposition=attachment');
  });

  it('sanitizes the content URL for safe iframe usage', () => {
    const component = buildComponent(buildAttachment('application/pdf'));

    expect(component.safeContentUrl).toBe('safe:/attachments/1/file.pdf');
  });

  it('restores focus to the triggering element on close', () => {
    const triggerElement = document.createElement('a');
    const component = buildComponent(buildAttachment('application/pdf'), triggerElement);

    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(component['afterFocusOn']).toBe(triggerElement);
  });

  it('falls back to the modal element when no triggering element was passed', () => {
    const component = buildComponent(buildAttachment('application/pdf'));
    component.ngOnInit();

    // eslint-disable-next-line @typescript-eslint/dot-notation
    expect(component['afterFocusOn']).toBe(component.element);
  });
});
