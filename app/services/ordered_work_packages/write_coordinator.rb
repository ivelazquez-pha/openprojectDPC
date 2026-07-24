# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#++

module OrderedWorkPackages
  ##
  # Centralizes every write to +OrderedWorkPackage+ (manual board/query
  # ordering) behind a single code path, shared by:
  #   * the +/api/v3/queries/:id/order+ PATCH endpoint
  #   * the bounded board "Sort by..." command
  #   * the query copy dependent service
  #
  # Callers are responsible for taking the appropriate lock on +query+ (and,
  # for multi-query board sorts, locking every participating query in
  # ascending id order) before calling this coordinator - it does not lock
  # anything itself.
  #
  # Release A / B rollout (see design "Writer / Index Rollout"): the unique
  # composite index on (query_id, work_package_id) may not exist yet, or may
  # exist but race with a concurrent writer that hasn't taken the same lock
  # (e.g. a not-yet-migrated writer). #upsert therefore recovers from
  # ActiveRecord::RecordNotUnique by re-reading and updating the row that won
  # the race, instead of raising.
  class WriteCoordinator
    REMOVE_SIGNALS = [nil, -1].freeze

    class << self
      ##
      # @param query [Query] the query whose ordered_work_packages are written.
      # @param positions [Hash] work_package_id => Integer position, or a
      #   value in REMOVE_SIGNALS to delete the row.
      def write_positions(query:, positions:)
        new(query).write_positions(positions)
      end
    end

    def initialize(query)
      @query = query
    end

    def write_positions(positions)
      existing = preload_existing(positions.keys)

      positions.each do |work_package_id, position|
        if REMOVE_SIGNALS.include?(position)
          remove(work_package_id, existing[work_package_id.to_i])
        else
          upsert(work_package_id, position, existing[work_package_id.to_i])
        end
      end
    end

    private

    def preload_existing(work_package_ids)
      @query
        .ordered_work_packages
        .where(work_package_id: work_package_ids)
        .index_by(&:work_package_id)
    end

    def remove(work_package_id, record)
      (record || @query.ordered_work_packages.find_by(work_package_id:))&.destroy
    end

    def upsert(work_package_id, position, record)
      record ||= @query.ordered_work_packages.build(work_package_id:)
      record.position = position
      record.save!
    rescue ActiveRecord::RecordInvalid, ActiveRecord::RecordNotUnique
      # Two distinct races can produce a duplicate here:
      #   * ActiveRecord::RecordInvalid - our own uniqueness validation found
      #     the competing row (works even before the DB index exists/is
      #     enforced - Release A).
      #   * ActiveRecord::RecordNotUnique - the DB-level unique index caught a
      #     genuine race between our validation SELECT and our INSERT
      #     (Release B, once the index is validated/enforced).
      # Either way, recover by updating the row that won the race instead of
      # failing the whole write.
      recover_from_conflicting_insert(work_package_id, position)
    end

    def recover_from_conflicting_insert(work_package_id, position)
      existing = @query.ordered_work_packages.find_by(work_package_id:)
      raise unless existing

      existing.update!(position:)
    end
  end
end
