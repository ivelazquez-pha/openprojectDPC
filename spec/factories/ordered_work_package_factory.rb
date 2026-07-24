# frozen_string_literal: true

FactoryBot.define do
  factory :ordered_work_package do
    query
    work_package
    sequence(:position) { |n| n }
  end
end
