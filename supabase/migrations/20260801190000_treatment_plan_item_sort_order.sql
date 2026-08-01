alter table public.treatment_plan_items
add column if not exists sort_order integer;

with ordered_items as (
  select
    id,
    row_number() over (
      partition by treatment_plan_id
      order by created_at asc, id asc
    ) - 1 as calculated_order
  from public.treatment_plan_items
)
update public.treatment_plan_items as item
set sort_order = ordered_items.calculated_order
from ordered_items
where item.id = ordered_items.id
  and item.sort_order is null;

create index if not exists
treatment_plan_items_plan_sort_order_idx
on public.treatment_plan_items (
  treatment_plan_id,
  sort_order
);
