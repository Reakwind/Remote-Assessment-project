-- Location context is no longer part of the MVP session creation contract.
-- Keep the legacy columns nullable for older rows/exports, but do not require
-- clinicians to collect place/city when ordering an assessment.

alter table sessions
  alter column location_place drop not null,
  alter column location_city drop not null;

comment on column sessions.location_place is 'Legacy optional session location context; not required for MVP.';
comment on column sessions.location_city is 'Legacy optional session city context; not required for MVP.';
