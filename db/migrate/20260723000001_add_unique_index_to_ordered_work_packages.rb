# frozen_string_literal: true

# Release A of the ordered_work_packages writer/index rollout (see design
# "Writer / Index Rollout"): deduplicate any pre-existing (query_id,
# work_package_id) rows before enforcing uniqueness, then add the composite
# unique index. Application code (OrderedWorkPackages::WriteCoordinator) is
# written to tolerate this index either being absent, unvalidated, or fully
# enforced, so this migration is safe to run before, during, or after the
# writer rollout completes.
class AddUniqueIndexToOrderedWorkPackages < ActiveRecord::Migration[8.1]
  def up
    say_with_time "Deduplicating ordered_work_packages rows" do
      execute <<~SQL.squish
        DELETE FROM ordered_work_packages a
          USING ordered_work_packages b
          WHERE a.query_id = b.query_id
            AND a.work_package_id = b.work_package_id
            AND a.id < b.id;
      SQL
    end

    add_index :ordered_work_packages,
              %i[query_id work_package_id],
              unique: true,
              name: "index_ordered_work_packages_on_query_and_work_package"
  end

  def down
    remove_index :ordered_work_packages,
                 name: "index_ordered_work_packages_on_query_and_work_package"
  end
end
