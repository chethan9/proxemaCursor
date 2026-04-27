ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS max_price numeric(10,2);

CREATE OR REPLACE FUNCTION recompute_product_price_range()
RETURNS trigger AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF pid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE products p
  SET min_price = sub.mn, max_price = sub.mx
  FROM (
    SELECT
      MIN(COALESCE(sale_price, regular_price, price)) AS mn,
      MAX(COALESCE(sale_price, regular_price, price)) AS mx
    FROM product_variations
    WHERE product_id = pid
      AND COALESCE(sale_price, regular_price, price) IS NOT NULL
  ) sub
  WHERE p.id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recompute_price_range ON product_variations;
CREATE TRIGGER trg_recompute_price_range
AFTER INSERT OR UPDATE OR DELETE ON product_variations
FOR EACH ROW EXECUTE FUNCTION recompute_product_price_range();

UPDATE products p
SET min_price = sub.mn, max_price = sub.mx
FROM (
  SELECT
    product_id,
    MIN(COALESCE(sale_price, regular_price, price)) AS mn,
    MAX(COALESCE(sale_price, regular_price, price)) AS mx
  FROM product_variations
  WHERE COALESCE(sale_price, regular_price, price) IS NOT NULL
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id;