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

/**
 * The set of preview rendering strategies the attachment preview modal supports.
 * This is the deliberate extension point for future content types (e.g. spreadsheets,
 * images, video, text) — add a new ordered entry here instead of branching in the modal.
 */
export type AttachmentPreviewKind = 'pdf'|'unsupported';

interface AttachmentPreviewStrategy {
  kind:AttachmentPreviewKind;
  matches:(contentType:string) => boolean;
}

export const ATTACHMENT_PREVIEW_STRATEGIES:AttachmentPreviewStrategy[] = [
  { kind: 'pdf', matches: (contentType) => contentType === 'application/pdf' },
  // future: { kind: 'spreadsheet', matches: ... } (Excel/xlsx, next priority)
  // future: { kind: 'image', matches: ... }, { kind: 'video', matches: ... }, { kind: 'text', matches: ... }
];

/**
 * Pure, DOM-free dispatch from an attachment's content type to a preview rendering kind.
 * Falls back to 'unsupported' for any content type with no matching strategy.
 */
export function attachmentPreviewKind(contentType?:string):AttachmentPreviewKind {
  const normalized = (contentType ?? '').split(';')[0].trim().toLowerCase();
  return ATTACHMENT_PREVIEW_STRATEGIES.find((strategy) => strategy.matches(normalized))?.kind ?? 'unsupported';
}
