-- Hand-corrected nutrition per serving: {"kcal":520,"protein":35,"carbs":40,"fat":18}. Empty = use the estimate.
alter table recipes add column if not exists nutrition jsonb;
select count(*) filter (where nutrition is not null) as corrected, count(*) as recipes from recipes;
