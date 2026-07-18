-- Store the full street address on the user profile so Google Places autofill
-- can persist the selected business/location address.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS address_line1 TEXT;
