-- 과거 기억 검색 다듬기. (아직 Supabase에 실행하지 않음 — 실행 전 팀 확인)
begin;
set local search_path = public, extensions;

-- 1) chat_summaries.created_at에 기본값이 없어서 시간 없이 저장된 요약이 있었다.
--    서버 코드에서도 시각을 넣지만, 비지 않도록 DB 기본값을 둔다.
alter table public.chat_summaries
  alter column created_at set default now();

-- 2) 비슷한 기억 기준을 코사인 거리 0.7 → 0.5로 좁힌다.
--    이제 매 답변마다 기억을 찾으므로, 0.7이면 관련 없는 요약이 자주 붙는다.
--    (실측: 관련 있는 요약 0.32~0.46, 관련 없는 요약 0.52~0.60)
--    서버는 인자 3개로 부르므로 바꾸기 전·후 모두 그대로 동작한다.
drop function if exists public.match_nownow_chat_memories(uuid, vector, bigint[]);

create function public.match_nownow_chat_memories(
  owner_id uuid, query_vector vector(1536), candidate_ids bigint[], max_distance float8 default 0.5
)
returns table (summary_id bigint, content text, created_at timestamptz)
language sql stable security invoker
set search_path = public, extensions, pg_temp
as $$
  select s.summary_id::bigint, m.content, s.created_at::timestamptz
  from public.memory_embeddings m
  join public.chat_summaries s on s.summary_id = m.nownow_summary_id
  where m.user_id = owner_id and s.user_id = owner_id
    and m.source_type = 'CHAT_SUMMARY'
    and s.summary_id = any(candidate_ids)
    and m.content = left(s.summary, 800)
    and (m.embedding <=> query_vector) <= max_distance
  order by m.embedding <=> query_vector
  limit 3;
$$;

revoke all on function public.match_nownow_chat_memories(uuid, vector, bigint[], float8) from public, anon, authenticated;
grant execute on function public.match_nownow_chat_memories(uuid, vector, bigint[], float8) to service_role;
notify pgrst, 'reload schema';
commit;
