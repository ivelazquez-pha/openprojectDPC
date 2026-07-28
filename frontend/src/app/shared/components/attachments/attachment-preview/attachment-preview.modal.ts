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

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { OpModalComponent } from 'core-app/shared/components/modal/modal.component';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { IAttachment } from 'core-app/core/state/attachments/attachment.model';
import {
  attachmentPreviewKind,
  AttachmentPreviewKind,
} from 'core-app/shared/components/attachments/attachment-preview/attachment-preview-kind';

export interface AttachmentPreviewModalOptions {
  attachment:IAttachment;
  triggerElement?:HTMLElement;
}

@Component({
  templateUrl: './attachment-preview.modal.html',
  styleUrls: ['./attachment-preview.modal.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class OpAttachmentPreviewModalComponent extends OpModalComponent {
  readonly I18n = inject(I18nService);

  private readonly sanitizer = inject(DomSanitizer);

  public readonly attachment:IAttachment;

  public readonly previewKind:AttachmentPreviewKind;

  public readonly contentUrl:string;

  public readonly downloadUrl:string;

  public readonly safeContentUrl:SafeResourceUrl;

  private readonly triggerElement:HTMLElement|null;

  public text = {
    title: '',
    download: this.I18n.t('js.attachments.download'),
    noPreviewAvailable: this.I18n.t('js.attachments.no_preview_available'),
  };

  constructor() {
    super();

    const options = this.locals as unknown as AttachmentPreviewModalOptions;

    this.attachment = options.attachment;
    this.triggerElement = options.triggerElement ?? null;
    this.previewKind = attachmentPreviewKind(this.attachment.contentType);
    // The content URL comes from the attachment's HAL link, never from user input, so
    // bypassing the sanitizer here is safe and required for the iframe [src] binding below.
    this.contentUrl = this.attachment._links.staticDownloadLocation.href;
    this.downloadUrl = `${this.contentUrl}?disposition=attachment`;
    this.safeContentUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.contentUrl);
    this.text.title = this.I18n.t('js.attachments.preview_title', { fileName: this.attachment.fileName });
  }

  protected get afterFocusOn():HTMLElement {
    return this.triggerElement ?? this.element;
  }
}
