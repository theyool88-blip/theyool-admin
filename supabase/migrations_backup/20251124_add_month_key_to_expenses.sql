-- Add month_key column to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS month_key VARCHAR(7);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_month_key ON expenses(month_key);

-- Update existing rows to populate month_key from expense_date
UPDATE expenses
SET month_key = TO_CHAR(expense_date, 'YYYY-MM')
WHERE month_key IS NULL;

-- Add trigger to automatically populate month_key when inserting/updating
CREATE OR REPLACE FUNCTION update_expenses_month_key()
RETURNS TRIGGER AS $$
BEGIN
  NEW.month_key := TO_CHAR(NEW.expense_date, 'YYYY-MM');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_expenses_month_key ON expenses;

CREATE TRIGGER trigger_update_expenses_month_key
  BEFORE INSERT OR UPDATE OF expense_date ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expenses_month_key();
