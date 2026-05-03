{% macro store_id_filter(column_name='store_id') -%}
  {#-
    Use when compiling with a single-tenant filter (local validation / Metabase store_id tests).
    dbt run --vars '{"store_id": "<uuid>"}'
  -#}
  {% if var('store_id', none) is not none and var('store_id') != '' %}
    and {{ column_name }} = '{{ var("store_id") }}'
  {% endif %}
{%- endmacro %}
