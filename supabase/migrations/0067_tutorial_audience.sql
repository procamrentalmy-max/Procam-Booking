-- Two tutorials: one for flying with your phone, one for flying with the controller. Every existing header stays with the phone tutorial.
alter table tutorial_sections add column audience text not null default 'PHONE' check (audience in ('PHONE', 'CONTROLLER'));
create index tutorial_sections_audience_idx on tutorial_sections (audience, position);
