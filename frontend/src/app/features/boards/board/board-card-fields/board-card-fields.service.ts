import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { ApiV3FilterBuilder } from 'core-app/shared/helpers/api-v3/api-v3-filter-builder';
import { TypeCardFieldsByTypeId } from 'core-app/features/work-packages/components/wp-card-view/wp-single-card/resolve-type-card-fields';

/**
 * Builds a `typeId -> configured board card field configs` map for Kanban
 * board cards.
 *
 * Types are fetched GLOBALLY via `/api/v3/types` (unscoped by project), NOT
 * limited to the board's own root project. This matters for Subproject-type
 * boards, where a column's work packages can belong to a different project
 * than the board's own, and Types are enabled per-project: scoping this
 * lookup to the board's root project would silently drop card fields for
 * work packages of a type only enabled in a subproject.
 *
 * The map is fetched once per board load and shared across every card via
 * `shareReplay`.
 */
@Injectable()
export class BoardCardFieldsService {
  private readonly apiV3Service = inject(ApiV3Service);

  private cachedMap$:Observable<TypeCardFieldsByTypeId>|null = null;

  /**
   * Returns (and caches) the `typeId -> fieldConfigs[]` map for every type
   * globally visible to the current user.
   */
  public map$():Observable<TypeCardFieldsByTypeId> {
    if (!this.cachedMap$) {
      this.cachedMap$ = this
        .apiV3Service
        .types
        .filtered(new ApiV3FilterBuilder())
        .getPaginatedResults()
        .pipe(
          map((types) => types.reduce<TypeCardFieldsByTypeId>((map, type) => {
            if (type.id) {
              map[type.id] = type.boardCardFields || [];
            }
            return map;
          }, {})),
          shareReplay(1),
        );
    }

    return this.cachedMap$;
  }
}
