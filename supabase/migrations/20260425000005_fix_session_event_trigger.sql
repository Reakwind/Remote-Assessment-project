-- Avoid referencing NEW.session_id when the trigger fires on sessions.

create or replace function log_session_event()
returns trigger as $$
declare
  v_event_type varchar(50);
  v_session_id uuid;
begin
  v_event_type := tg_table_name || '_' || lower(tg_op);

  if tg_table_name = 'sessions' then
    v_session_id := new.id;
  else
    v_session_id := new.session_id;
  end if;

  if tg_op = 'INSERT' then
    insert into session_events (session_id, event_type, actor_id, new_data)
    values (v_session_id, tg_table_name || '_created', auth.uid(), row_to_json(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into session_events (session_id, event_type, actor_id, old_data, new_data)
    values (v_session_id, tg_table_name || '_updated', auth.uid(), row_to_json(old), row_to_json(new));
    return new;
  end if;

  return null;
end;
$$ language plpgsql security definer;
