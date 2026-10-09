-- Row Level Security: everyone may read, nobody but the service role may write.
-- The service role is only used inside the epl-writer and epl-demo edge functions.
alter table public.epl_matches            enable row level security;
alter table public.epl_model_registry     enable row level security;
alter table public.epl_target_selection   enable row level security;
alter table public.epl_model_evaluations  enable row level security;
alter table public.epl_predictions        enable row level security;
alter table public.epl_demo_runs          enable row level security;
alter table public.epl_demo_run_items     enable row level security;
alter table public.epl_data_source_audit  enable row level security;
alter table public.epl_pipeline_runs      enable row level security;

create policy epl_matches_read           on public.epl_matches           for select to anon, authenticated using (true);
create policy epl_model_registry_read    on public.epl_model_registry    for select to anon, authenticated using (true);
create policy epl_target_selection_read  on public.epl_target_selection  for select to anon, authenticated using (true);
create policy epl_model_evaluations_read on public.epl_model_evaluations for select to anon, authenticated using (true);
create policy epl_predictions_read       on public.epl_predictions       for select to anon, authenticated using (true);
create policy epl_demo_runs_read         on public.epl_demo_runs         for select to anon, authenticated using (true);
create policy epl_demo_run_items_read    on public.epl_demo_run_items    for select to anon, authenticated using (true);
create policy epl_data_source_audit_read on public.epl_data_source_audit for select to anon, authenticated using (true);
create policy epl_pipeline_runs_read     on public.epl_pipeline_runs     for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on
  public.epl_matches, public.epl_model_registry, public.epl_target_selection, public.epl_model_evaluations,
  public.epl_predictions, public.epl_demo_runs, public.epl_demo_run_items, public.epl_data_source_audit,
  public.epl_pipeline_runs
from anon, authenticated;
