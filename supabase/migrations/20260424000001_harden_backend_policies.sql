-- Restrict clinical writes to Edge Functions and service-role workflows.

drop policy if exists "clinicians can manage own sessions" on sessions;
create policy "clinicians can read own sessions"
  on sessions for select
  using (clinician_id = auth.uid());

drop policy if exists "clinicians can update own scoring reports" on scoring_reports;
drop policy if exists "clinicians can update own drawing reviews" on drawing_reviews;

-- The previous stimuli write policy used a broad USING clause on a FOR ALL
-- policy, which could permit non-service roles to delete or update stimuli.
drop policy if exists "Admin Write Access to Stimuli" on storage.objects;
create policy "Service role can manage stimuli"
  on storage.objects for all
  using (bucket_id = 'stimuli' and auth.role() = 'service_role')
  with check (bucket_id = 'stimuli' and auth.role() = 'service_role');
