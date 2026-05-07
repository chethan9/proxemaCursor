-- Allow bulk jobs for tag and brand assignment (aligned with BulkJobType in bulkJobService.ts).
ALTER TABLE bulk_jobs DROP CONSTRAINT IF EXISTS bulk_jobs_job_type_check;
ALTER TABLE bulk_jobs ADD CONSTRAINT bulk_jobs_job_type_check CHECK (
  job_type IN (
    'update_order_status',
    'delete_orders',
    'update_product_price',
    'update_product_stock',
    'update_product_status',
    'assign_product_categories',
    'assign_product_tags',
    'assign_product_brands',
    'delete_products',
    'print_invoices_bulk'
  )
);
