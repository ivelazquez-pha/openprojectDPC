# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

module Boards
  ##
  # Bounded, synchronous, one-shot "Sort by..." command for a Kanban board.
  #
  # Sorts every column's *effective filtered* work packages (existing board
  # filters apply first) by a single field/direction, and writes the result
  # as ordinary manual positions through OrderedWorkPackages::WriteCoordinator
  # - it never changes Query#sort_criteria. See design "Bounded Sort Data
  # Flow" for the exact algorithm this implements.
  #
  # @example
  #   result = Boards::BoardOrderService
  #     .new(user: current_user, board:, field: "due_date", direction: "asc")
  #     .call
  #   result.success? # => true
  #
  # On failure, result.result is one of:
  #   :unauthorized     - board is no longer visible, or a query no longer
  #                       authorizes reorder_work_packages (map to 404)
  #   :invalid_field    - the field is not a plain, non-association sortable
  #                       attribute on ANY participating column (map to
  #                       422/400)
  #   :limit_exceeded   - the effective canvas totals 501+ cards (map to 422,
  #                       zero writes)
  #   :retry_exhausted  - serialization/deadlock retries exhausted (map to
  #                       409, zero writes from any attempt)
  class BoardOrderService
    MAX_CARDS = 500
    MAX_RETRY_ATTEMPTS = 3
    RETRYABLE_ERRORS = [ActiveRecord::SerializationFailure, ActiveRecord::Deadlocked].freeze

    class UnauthorizedError < StandardError; end
    class UnsortableFieldError < StandardError; end
    class LimitExceededError < StandardError; end

    def self.call(...) = new(...).call

    # @param max_cards [Integer] the total-canvas limit (default 500, per the
    #   spec). Overridable only so tests can exercise the boundary without
    #   creating hundreds of work packages; production callers should not
    #   pass this.
    def initialize(user:, board:, field:, direction:, max_cards: MAX_CARDS)
      @user = user
      @board = board
      @field = field.to_s
      @direction = direction.to_s.casecmp("desc").zero? ? "desc" : "asc"
      @max_cards = max_cards
    end

    def call
      attempt_with_retries { run_bounded_transaction { write_all_columns! } }

      ServiceResult.success
    rescue UnauthorizedError
      ServiceResult.failure(result: :unauthorized)
    rescue UnsortableFieldError
      ServiceResult.failure(result: :invalid_field)
    rescue LimitExceededError
      ServiceResult.failure(result: :limit_exceeded)
    rescue RetryExhaustedError
      ServiceResult.failure(result: :retry_exhausted)
    end

    private

    class RetryExhaustedError < StandardError; end

    def attempt_with_retries
      attempts = 0

      begin
        yield
      rescue *RETRYABLE_ERRORS
        attempts += 1
        raise RetryExhaustedError if attempts >= MAX_RETRY_ATTEMPTS

        sleep(retry_jitter(attempts))
        retry
      end
    end

    def retry_jitter(attempt)
      (0.05 * attempt) + rand(0.0..0.05)
    end

    ##
    # RSpec wraps every example in an outer transaction; Postgres does not
    # allow setting an isolation level on a nested transaction/savepoint. In
    # that (test-only) case we fall back to a real savepoint without an
    # explicit isolation level - still atomic/rollback-safe for the purposes
    # of a single-threaded example. In production this transaction is the
    # outermost one for the request, so the isolation level applies.
    def run_bounded_transaction(&block)
      if ActiveRecord::Base.connection.open_transactions.zero?
        ActiveRecord::Base.transaction(isolation: :repeatable_read, &block)
      else
        ActiveRecord::Base.transaction(requires_new: true, &block)
      end
    end

    def write_all_columns!
      @board.reload

      raise UnauthorizedError unless board_visible?

      queries = locked_queries_in_ascending_id_order
      raise UnauthorizedError unless all_queries_present_and_authorized?(queries)

      sortable = resolve_sortable_field(queries.values)
      raise UnsortableFieldError unless sortable

      ids_by_query_id = bounded_materialization(queries, sortable)

      ids_by_query_id.each do |query_id, ids|
        query = queries.fetch(query_id)
        positions = ids.each_with_index.to_h

        OrderedWorkPackages::WriteCoordinator.write_positions(query:, positions:)
        query.touch
      end
    end

    def board_visible?
      ::OpenProject::Boards::GridRegistration.visible(@user).exists?(id: @board.id)
    end

    def all_queries_present_and_authorized?(queries)
      return false if canonical_query_ids.any? { |id| queries[id].nil? }

      policy = QueryPolicy.new(@user)
      queries.values.all? { |query| policy.allowed?(query, :reorder_work_packages) }
    end

    def bounded_materialization(queries, sortable)
      cumulative = 0
      ids_by_query_id = {}

      canonical_query_ids.each do |query_id|
        query = queries.fetch(query_id)
        remaining = @max_cards - cumulative

        ids = ordered_ids(query, sortable, remaining + 1)
        raise LimitExceededError if ids.size > remaining

        cumulative += ids.size
        ids_by_query_id[query_id] = ids
      end

      ids_by_query_id
    end

    ##
    # Applies the resolved expression/join (see #resolve_sortable_field) to
    # this specific column's query. The join is only added when this query's
    # own persisted sort_criteria doesn't already bring it in via
    # `Query::Results#sort_criteria_joins` - adding the identical raw-SQL
    # join twice would duplicate its alias and fail in Postgres.
    def ordered_ids(query, sortable, limit)
      direction_sql = @direction == "desc" ? "DESC" : "ASC"

      scope = query.results.work_packages
      scope = scope.joins(sortable[:join]) if sortable[:join].present? && !query_already_joins_field?(query)

      scope
        .reorder(Arel.sql("#{sortable[:expression]} #{direction_sql} NULLS LAST"), :id)
        .limit(limit)
        .pluck(:id)
    end

    def query_already_joins_field?(query)
      query.sort_criteria_columns.any? { |column, _direction| column.name.to_s == @field }
    end

    ##
    # The board's own widgets, in canonical column order (start_column, then
    # start_row), deriving unique query ids server-side. Client-supplied
    # query/work-package ids are never trusted.
    def canonical_query_ids
      @canonical_query_ids ||= @board
        .widgets
        .where(identifier: "work_package_query")
        .order(:start_column, :start_row)
        .filter_map { |widget| widget.options["queryId"] || widget.options["query_id"] }
        .map(&:to_i)
        .uniq
    end

    def locked_queries_in_ascending_id_order
      ::Query
        .where(id: canonical_query_ids)
        .order(:id)
        .lock
        .index_by(&:id)
    end

    ##
    # Resolves the plain, non-association SQL expression (and its optional
    # join) for @field by finding it as a sortable column on AT LEAST ONE
    # participating query - NOT on every one (see board-sort-field.ts
    # `unionSortableFields` for the matching frontend picker behavior; a
    # field only sortable on some columns, e.g. a custom field enabled for
    # one column's project but not another's, must still be accepted here).
    #
    # Only plain WorkPackage-table columns and custom fields are supported
    # (id, subject, dates, hours, custom fields...) - other association-
    # backed columns (status, priority, assignee...) are excluded, matching
    # the frontend's `ASSOCIATION_BACKED_FIELD_IDS`.
    #
    # The same expression/join is applied to every column in #ordered_ids:
    # for columns whose own project doesn't expose the field (typically a
    # custom field not enabled there), the LEFT JOIN this returns naturally
    # yields NULL for every row in that column - nothing to match - which
    # sorts last via the existing "NULLS LAST" handling. It never errors and
    # never excludes rows.
    def resolve_sortable_field(queries)
      return nil if queries.empty?

      queries.each do |query|
        column = plain_sortable_column(query)
        return { expression: column.sortable, join: column.sortable_join_statement(query) } if column
      end

      nil
    end

    def plain_sortable_column(query)
      column = query.sortable_columns.detect { |candidate| candidate.name.to_s == @field }
      return nil unless column
      return nil unless column.sortable.is_a?(String)
      return nil if column.respond_to?(:association) && column.association.present?

      column
    end
  end
end
