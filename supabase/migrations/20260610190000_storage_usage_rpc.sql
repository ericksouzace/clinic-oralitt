create or replace function public.get_database_usage()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  used_bytes bigint;
  used_mb numeric;
  limit_mb numeric := 500;
begin
  used_bytes := pg_database_size(current_database());
  used_mb := round((used_bytes / 1024.0 / 1024.0)::numeric, 2);

  return jsonb_build_object(
    'used_bytes', used_bytes,
    'used_mb', used_mb,
    'limit_mb', limit_mb,
    'remaining_mb', greatest(limit_mb - used_mb, 0),
    'percentage', round(((used_mb / limit_mb) * 100)::numeric, 2)
  );
end;
$$;

create or replace function public.get_storage_usage()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  used_bytes bigint;
  used_mb numeric;
  limit_mb numeric := 1024;
  files_count bigint;
begin
  select
    coalesce(sum(
      case
        when metadata ? 'size' and (metadata->>'size') ~ '^[0-9]+$'
          then (metadata->>'size')::bigint
        else 0
      end
    ), 0)::bigint,
    count(*)::bigint
  into used_bytes, files_count
  from storage.objects;

  used_mb := round((used_bytes / 1024.0 / 1024.0)::numeric, 2);

  return jsonb_build_object(
    'used_bytes', used_bytes,
    'used_mb', used_mb,
    'limit_mb', limit_mb,
    'remaining_mb', greatest(limit_mb - used_mb, 0),
    'percentage', round(((used_mb / limit_mb) * 100)::numeric, 2),
    'files_count', files_count
  );
end;
$$;

revoke execute on function public.get_database_usage() from anon;
revoke execute on function public.get_storage_usage() from anon;
grant execute on function public.get_database_usage() to authenticated;
grant execute on function public.get_storage_usage() to authenticated;
