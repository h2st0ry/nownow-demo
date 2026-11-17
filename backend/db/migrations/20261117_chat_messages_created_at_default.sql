-- chat_messages.created_at에 기본값이 없어서 시각 없이 저장된 메시지가 있었다.
-- 서버 코드에서도 시각을 넣지만, 다른 경로로 들어와도 비지 않도록 DB 기본값을 둔다.
-- 이미 시각 없이 저장된 옛 메시지는 언제 보냈는지 알 수 없어 그대로 둔다.
alter table public.chat_messages
  alter column created_at set default now();
