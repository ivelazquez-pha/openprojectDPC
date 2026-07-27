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

import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { PathHelperService } from 'core-app/core/path-helper/path-helper.service';
import { TimezoneService } from 'core-app/core/datetime/timezone.service';
import { ConfirmDialogService } from 'core-app/shared/components/modals/confirm-dialog/confirm-dialog.service';
import { PrincipalsResourceService } from 'core-app/core/state/principals/principals.service';
import { PrincipalRendererService } from 'core-app/shared/components/principal/principal-renderer.service';
import { OpModalService } from 'core-app/shared/components/modal/modal.service';
import { IAttachment, IAttachmentHalResourceLinks } from 'core-app/core/state/attachments/attachment.model';
import { OpAttachmentPreviewModalComponent } from 'core-app/shared/components/attachments/attachment-preview/attachment-preview.modal';
import { OpAttachmentListItemComponent } from './attachment-list-item.component';
import type { Mock } from 'vitest';

describe('OpAttachmentListItemComponent - preview click interception', () => {
  function buildAttachment(overrides:Partial<IAttachment> = {}, linkOverrides:Partial<IAttachmentHalResourceLinks> = {}):IAttachment {
    return {
      id: 1,
      title: 'file.pdf',
      status: 'uploaded',
      fileName: 'file.pdf',
      fileSize: 10,
      description: {} as IAttachment['description'],
      contentType: 'application/pdf',
      digest: 'x',
      createdAt: '2026-01-01T00:00:00Z',
      _links: {
        self: { href: '' },
        delete: { href: '' },
        container: { href: '' },
        author: { href: '/api/v3/users/1' },
        downloadLocation: { href: '' },
        staticDownloadLocation: { href: '/attachments/1/file.pdf' },
        originOpen: undefined as unknown as IAttachmentHalResourceLinks['originOpen'],
        ...linkOverrides,
      },
      ...overrides,
    } as IAttachment;
  }

  function buildEvent(overrides:Partial<Record<string, unknown>> = {}):{ evt:MouseEvent, preventDefault:Mock } {
    const preventDefault = vi.fn();
    const evt = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault,
      currentTarget: document.createElement('a'),
      ...overrides,
    } as unknown as MouseEvent;

    return { evt, preventDefault };
  }

  function buildComponent(showSpy:Mock = vi.fn()) {
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: { t: (key:string) => key } },
        { provide: PathHelperService, useValue: { attachmentDownloadPath: () => '/download' } },
        { provide: TimezoneService, useValue: { parseDatetime: () => ({ fromNow: () => '' }) } },
        { provide: ConfirmDialogService, useValue: { confirm: vi.fn() } },
        { provide: PrincipalsResourceService, useValue: { requireEntity: () => of({}) } },
        { provide: PrincipalRendererService, useValue: { render: vi.fn() } },
        { provide: OpModalService, useValue: { show: showSpy } },
        Injector,
      ],
    });

    return TestBed.runInInjectionContext(() => new OpAttachmentListItemComponent());
  }

  afterEach(() => TestBed.resetTestingModule());

  it('opens the preview modal on a plain left-click and prevents default navigation', () => {
    const showSpy = vi.fn().mockReturnValue(of({}));
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment();

    const { evt, preventDefault } = buildEvent();
    component.openPreview(evt);

    expect(preventDefault).toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalledWith(
      OpAttachmentPreviewModalComponent,
      expect.anything(),
      expect.objectContaining({ attachment: component.attachment, triggerElement: evt.currentTarget }),
    );
  });

  it('does not open the modal on ctrl-click', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment();

    const { evt, preventDefault } = buildEvent({ ctrlKey: true });
    component.openPreview(evt);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('does not open the modal on meta-click', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment();

    const { evt } = buildEvent({ metaKey: true });
    component.openPreview(evt);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('does not open the modal on shift-click', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment();

    const { evt } = buildEvent({ shiftKey: true });
    component.openPreview(evt);

    expect(showSpy).not.toHaveBeenCalled();
  });

  it('does not open the modal on alt-click', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment();

    const { evt } = buildEvent({ altKey: true });
    component.openPreview(evt);

    expect(showSpy).not.toHaveBeenCalled();
  });

  // NOTE: real middle-clicks dispatch `auxclick`, not `click`, so openPreview() is never
  // actually invoked by the browser on a middle-click - this only verifies the isolated
  // `button !== 0` branch, not real DOM middle-click behaviour (which the browser already
  // handles natively, since (click) never fires for it).
  it('does not proceed when called with a non-primary button value', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment();

    const { evt, preventDefault } = buildEvent({ button: 1 });
    component.openPreview(evt);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('does not open the modal for quarantined attachments', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment({ status: 'quarantined' });

    const { evt, preventDefault } = buildEvent();
    component.openPreview(evt);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('does not open the modal when the attachment opens in its own storage-provider UI', () => {
    const showSpy = vi.fn();
    const component = buildComponent(showSpy);
    component.attachment = buildAttachment({}, { originOpen: { href: 'https://storage.example/open', title: 'Open in storage' } });

    const { evt, preventDefault } = buildEvent();
    component.openPreview(evt);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });

  it('leaves the drag-and-drop payload construction unchanged', () => {
    const component = buildComponent();
    component.attachment = buildAttachment();

    const setData = vi.fn();
    const dataTransfer = {
      setData,
      setDragImage: vi.fn(),
    } as unknown as DataTransfer;
    const dragEvt = { dataTransfer } as unknown as DragEvent;

    component.setDragData(dragEvt);

    expect(setData).toHaveBeenCalledWith('text/plain', '/download');
    expect(setData).toHaveBeenCalledWith('text/uri-list', '/download');
  });
});
